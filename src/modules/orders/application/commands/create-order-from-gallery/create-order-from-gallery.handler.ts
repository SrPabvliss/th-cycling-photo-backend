import { AUTH_USER_REPOSITORY, type IAuthUserRepository } from '@auth/domain/ports'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import { Order } from '@orders/domain/entities'
import { type IOrderWriteRepository, ORDER_WRITE_REPOSITORY } from '@orders/domain/ports'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { CreateOrderFromGalleryCommand } from './create-order-from-gallery.command'

@CommandHandler(CreateOrderFromGalleryCommand)
export class CreateOrderFromGalleryHandler
  implements ICommandHandler<CreateOrderFromGalleryCommand>
{
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly orderWriteRepo: IOrderWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(command: CreateOrderFromGalleryCommand): Promise<EntityIdProjection> {
    // 1. Validate event exists and is active
    const event = await this.eventReadRepo.existsActiveEvent(command.eventId)
    if (!event) throw AppException.notFound('entities.event', command.eventId)

    // 2. Validate all photoIds belong to the event
    const validPhotoCount = await this.photoReadRepo.countByIdsAndEvent(
      command.photoIds,
      command.eventId,
    )
    if (validPhotoCount !== command.photoIds.length) {
      throw AppException.businessRule('order.photos_not_in_event')
    }

    // 3. Get user snap data (includes profile + phone validation)
    const snapData = await this.authUserRepo.getUserSnapData(command.userId)
    if (!snapData) throw AppException.businessRule('order.customer_profile_required')
    if (snapData.countryId === null) {
      throw AppException.businessRule('order.customer_profile_required')
    }

    // 4. Create order with snap fields
    const order = Order.create({
      previewLinkId: null,
      eventId: command.eventId,
      userId: command.userId,
      notes: null,
      bibNumber: command.bibNumber,
    })

    const saved = await this.orderWriteRepo.saveWithSnap(order, {
      snapFirstName: snapData.firstName,
      snapLastName: snapData.lastName,
      snapEmail: snapData.email,
      snapPhone: snapData.phone,
      snapCountryId: snapData.countryId,
      snapProvinceId: snapData.provinceId,
      snapCantonId: snapData.cantonId,
      snapCategoryName: command.snapCategoryName,
    })

    // 5. Save order items (photo associations)
    await this.orderWriteRepo.savePhotos(saved.id, command.photoIds)

    // 6. Emit notification
    this.notifications.emitOrderCreated({
      orderId: saved.id,
      eventName: event.name,
      customerName: [snapData.firstName, snapData.lastName].filter(Boolean).join(' '),
      photoCount: command.photoIds.length,
      createdAt: saved.createdAt,
    })

    return { id: saved.id }
  }
}
