import { FindOrCreateCustomerCommand } from '@customers/application/commands'
import { Inject } from '@nestjs/common'
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import { Order } from '@orders/domain/entities'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
import {
  type IPreviewLinkReadRepository,
  type IPreviewLinkWriteRepository,
  PREVIEW_LINK_READ_REPOSITORY,
  PREVIEW_LINK_WRITE_REPOSITORY,
} from '@previews/domain/ports'
import { PreviewLinkStatus } from '@previews/domain/value-objects/preview-link-status.vo'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { CreateOrderFromPreviewCommand } from './create-order-from-preview.command'

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
    private readonly commandBus: CommandBus,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(command: CreateOrderFromPreviewCommand): Promise<EntityIdProjection> {
    // 1. Validate preview link
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

    // 2. Check if an order already exists for this preview link
    const orderExists = await this.orderReadRepo.existsByPreviewLinkId(previewLink.id)
    if (orderExists) {
      throw AppException.businessRule('order.already_submitted')
    }

    // 3. Validate photo IDs are subset of preview photos
    const previewPhotoIds = await this.orderReadRepo.getPreviewPhotoIds(previewLink.id)
    const invalidPhotos = command.photoIds.filter((id) => !previewPhotoIds.includes(id))
    if (invalidPhotos.length > 0) {
      throw AppException.businessRule('order.photos_not_in_preview')
    }

    // 4. Find or create customer
    const { id: customerId } = await this.commandBus.execute<
      FindOrCreateCustomerCommand,
      EntityIdProjection
    >(
      new FindOrCreateCustomerCommand(
        command.firstName,
        command.lastName,
        command.whatsapp,
        command.email,
      ),
    )

    // 5. Create order
    const order = Order.create({
      previewLinkId: previewLink.id,
      eventId: previewLink.eventId,
      customerId,
      notes: command.notes,
    })

    const saved = await this.orderWriteRepo.save(order)
    await this.orderWriteRepo.savePhotos(saved.id, command.photoIds)

    // 6. Transition preview link to converted (if first order)
    if (previewLink.status === PreviewLinkStatus.ACTIVE) {
      previewLink.markConverted()
      await this.previewWriteRepo.save(previewLink)
    }

    // 7. Emit notification (fetch detail to get eventName)
    const detail = await this.orderReadRepo.getDetail(saved.id)
    this.notifications.emitOrderCreated({
      orderId: saved.id,
      eventName: detail?.eventName ?? '',
      customerName: `${command.firstName} ${command.lastName}`,
      photoCount: command.photoIds.length,
      createdAt: saved.createdAt,
    })

    return { id: saved.id }
  }
}
