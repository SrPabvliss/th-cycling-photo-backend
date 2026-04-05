import { AUTH_USER_REPOSITORY, type IAuthUserRepository } from '@auth/domain/ports'
import type { CheckoutResultProjection } from '@cart/application/projections'
import {
  CART_READ_REPOSITORY,
  CART_WRITE_REPOSITORY,
  type ICartReadRepository,
  type ICartWriteRepository,
} from '@cart/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import { Order } from '@orders/domain/entities'
import { type IOrderWriteRepository, ORDER_WRITE_REPOSITORY } from '@orders/domain/ports'
import { AppException } from '@shared/domain'
import { CheckoutCartCommand } from './checkout-cart.command'

@CommandHandler(CheckoutCartCommand)
export class CheckoutCartHandler implements ICommandHandler<CheckoutCartCommand> {
  constructor(
    @Inject(CART_READ_REPOSITORY) private readonly cartReadRepo: ICartReadRepository,
    @Inject(CART_WRITE_REPOSITORY) private readonly cartWriteRepo: ICartWriteRepository,
    @Inject(ORDER_WRITE_REPOSITORY) private readonly orderWriteRepo: IOrderWriteRepository,
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(command: CheckoutCartCommand): Promise<CheckoutResultProjection> {
    // 1. Find active user cart
    const cart = await this.cartReadRepo.findActiveByUserId(command.userId)
    if (!cart) throw AppException.businessRule('cart.no_active_cart')

    // 2. Get cart items grouped by event
    const cartItemsByEvent = await this.cartReadRepo.getCartItemsByEvent(cart.id)
    if (cartItemsByEvent.length === 0) throw AppException.businessRule('cart.cart_empty')

    // 3. Build lookup of cart items by eventId
    const cartEventMap = new Map(cartItemsByEvent.map((g) => [g.eventId, g]))

    // 4. Validate all checkout events exist in cart
    for (const item of command.items) {
      if (!cartEventMap.has(item.eventId)) {
        throw AppException.businessRule('cart.event_not_in_cart')
      }
    }

    // 5. Get user snap data
    const snapData = await this.authUserRepo.getUserSnapData(command.userId)
    if (!snapData) throw AppException.businessRule('order.customer_profile_required')
    if (snapData.countryId === null) {
      throw AppException.businessRule('order.customer_profile_required')
    }

    // 6. Create one order per event
    const orderResults: { orderId: string; eventName: string; photoCount: number }[] = []

    for (const item of command.items) {
      const cartEvent = cartEventMap.get(item.eventId)
      if (!cartEvent) continue

      const order = Order.create({
        previewLinkId: null,
        eventId: item.eventId,
        userId: command.userId,
        notes: null,
        bibNumber: item.bibNumber ?? null,
      })

      const saved = await this.orderWriteRepo.saveWithSnap(order, {
        snapFirstName: snapData.firstName,
        snapLastName: snapData.lastName,
        snapEmail: snapData.email,
        snapPhone: snapData.phone,
        snapCountryId: snapData.countryId,
        snapProvinceId: snapData.provinceId,
        snapCantonId: snapData.cantonId,
        snapCategoryName: item.snapCategoryName ?? null,
      })

      await this.orderWriteRepo.savePhotos(saved.id, cartEvent.photoIds)

      orderResults.push({
        orderId: saved.id,
        eventName: cartEvent.eventName,
        photoCount: cartEvent.photoIds.length,
      })

      // Emit notification for each order
      this.notifications.emitOrderCreated({
        orderId: saved.id,
        eventName: cartEvent.eventName,
        customerName: [snapData.firstName, snapData.lastName].filter(Boolean).join(' '),
        photoCount: cartEvent.photoIds.length,
        createdAt: saved.createdAt,
      })
    }

    // 7. Mark cart as converted
    await this.cartWriteRepo.markConverted(cart.id)

    return { orders: orderResults }
  }
}
