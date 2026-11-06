import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import type { PreviewOrderCreatedProjection } from '@orders/application/projections'
import { BuyerPurchaseSnapshotService } from '@orders/application/services/buyer-purchase-snapshot.service'
import { Order } from '@orders/domain/entities'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
import { PaymentMethod } from '@orders/domain/value-objects/payment-method.vo'
import { PaymentReceiverResolver } from '@payments/application/services/payment-receiver-resolver.service'
import {
  type IPaymentTransactionWriteRepository,
  PAYMENT_TRANSACTION_WRITE_REPOSITORY,
} from '@payments/domain/ports'
import {
  type IPreviewLinkReadRepository,
  type IPreviewLinkWriteRepository,
  PREVIEW_LINK_READ_REPOSITORY,
  PREVIEW_LINK_WRITE_REPOSITORY,
} from '@previews/domain/ports'
import { PreviewLinkStatus } from '@previews/domain/value-objects/preview-link-status.vo'
import { PricingCalculator } from '@pricing/domain/services/pricing-calculator.service'
import {
  DEFAULT_CURRENCY,
  DEFAULT_PRICING_TIERS,
} from '@pricing/infrastructure/config/default-pricing-tiers'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AppException } from '@shared/domain'
import { CreateOrderFromPreviewCommand } from './create-order-from-preview.command'

/**
 * Places the order a buyer builds from a preview link, priced, snapshotted and billable exactly
 * like a cart checkout: transfer leaves it pending, card leaves a draft for the payment intent.
 * A buyer retrying an abandoned card payment rewrites their own draft instead of being refused.
 */
@CommandHandler(CreateOrderFromPreviewCommand)
export class CreateOrderFromPreviewHandler
  implements ICommandHandler<CreateOrderFromPreviewCommand>
{
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly orderWriteRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly orderReadRepo: IOrderReadRepository,
    @Inject(PREVIEW_LINK_READ_REPOSITORY)
    private readonly previewReadRepo: IPreviewLinkReadRepository,
    @Inject(PREVIEW_LINK_WRITE_REPOSITORY)
    private readonly previewWriteRepo: IPreviewLinkWriteRepository,
    @Inject(PAYMENT_TRANSACTION_WRITE_REPOSITORY)
    private readonly transactionWriteRepo: IPaymentTransactionWriteRepository,
    private readonly buyerSnapshot: BuyerPurchaseSnapshotService,
    private readonly receiverResolver: PaymentReceiverResolver,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(command: CreateOrderFromPreviewCommand): Promise<PreviewOrderCreatedProjection> {
    const previewLink = await this.previewReadRepo.findByToken(command.token)
    if (!previewLink) throw AppException.notFound('entities.preview_link', command.token)

    if (
      previewLink.status !== PreviewLinkStatus.ACTIVE &&
      previewLink.status !== PreviewLinkStatus.CONVERTED
    ) {
      throw AppException.businessRule('order.preview_not_available')
    }

    if (previewLink.checkExpiration()) {
      await this.previewWriteRepo.save(previewLink)
      throw AppException.businessRule('order.preview_expired')
    }

    const photoIds = [...new Set(command.photoIds)]
    const previewPhotoIds = await this.orderReadRepo.getPreviewPhotoIds(previewLink.id)
    if (photoIds.some((id) => !previewPhotoIds.includes(id))) {
      throw AppException.businessRule('order.photos_not_in_preview')
    }

    if (
      command.method === PaymentMethod.CARD &&
      !(await this.receiverResolver.acceptsCard(previewLink.eventId))
    ) {
      throw AppException.businessRule('payment.card_unavailable')
    }

    const buyer = await this.buyerSnapshot.build(
      command.userId,
      command.billingAccountId,
      command.snapCategoryName,
    )

    const calc = PricingCalculator.calculate(photoIds.length, DEFAULT_PRICING_TIERS)
    const subtotal = Math.round(calc.unitPrice * photoIds.length * 100) / 100
    const snapPricingConfig = DEFAULT_PRICING_TIERS.map((t) => t.toJSON())
    const items = photoIds.map((photoId) => ({ photoId, unitPrice: calc.unitPrice }))

    const saved = await this.orderWriteRepo.lockAndUpsertPreviewOrder(
      previewLink.id,
      async (existing, tx) => {
        if (existing && (!existing.isDraft || existing.userId !== command.userId)) {
          throw AppException.businessRule('order.already_submitted')
        }

        if (existing) {
          await this.transactionWriteRepo.expireOpenByOrderId(existing.id, tx)
          const rewritten = Order.fromPersistence({
            ...existing,
            notes: command.notes,
            bibNumber: command.bibNumber,
            subtotal,
            snapCurrency: DEFAULT_CURRENCY,
            snapPricingConfig,
            paymentMethod: command.method,
          })
          if (command.method === PaymentMethod.TRANSFER) rewritten.confirmDraftAsPending()
          return { order: rewritten, items, snap: buyer.snap }
        }

        const data = {
          previewLinkId: previewLink.id,
          eventId: previewLink.eventId,
          userId: command.userId,
          notes: command.notes,
          bibNumber: command.bibNumber,
          subtotal,
          snapCurrency: DEFAULT_CURRENCY,
          snapPricingConfig,
          paymentMethod: command.method,
        }
        const order =
          command.method === PaymentMethod.TRANSFER ? Order.create(data) : Order.createDraft(data)
        return { order, items, snap: buyer.snap }
      },
    )

    if (previewLink.status === PreviewLinkStatus.ACTIVE) {
      previewLink.markConverted()
      await this.previewWriteRepo.save(previewLink)
    }

    if (!saved.isDraft) {
      // Re-fetch of the order this handler just created, not a caller-driven read: no tenant boundary.
      const detail = await this.orderReadRepo.getDetail(saved.id, EventScope.unrestricted())
      this.notifications.emitOrderCreated({
        orderId: saved.id,
        eventName: detail?.eventName ?? '',
        customerName: buyer.customerName,
        photoCount: photoIds.length,
        subtotal,
        currency: DEFAULT_CURRENCY,
        createdAt: saved.createdAt,
        actorUserId: command.userId,
      })
    }

    return {
      id: saved.id,
      subtotal,
      currency: DEFAULT_CURRENCY,
      photoCount: photoIds.length,
      method: command.method,
    }
  }
}
