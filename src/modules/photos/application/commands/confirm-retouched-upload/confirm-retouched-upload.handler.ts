import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  NotificationEvent,
  type OrderRetouchCompletedPayload,
} from '@notifications/application/services/notification-events'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import {
  type IPhotoReadRepository,
  type IPhotoWriteRepository,
  PHOTO_READ_REPOSITORY,
  PHOTO_WRITE_REPOSITORY,
} from '@photos/domain/ports'
import { type IKvStorageAdapter, KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { nanoid } from 'nanoid'
import { ConfirmRetouchedUploadCommand } from './confirm-retouched-upload.command'

@CommandHandler(ConfirmRetouchedUploadCommand)
export class ConfirmRetouchedUploadHandler
  implements ICommandHandler<ConfirmRetouchedUploadCommand>
{
  private readonly logger = new Logger(ConfirmRetouchedUploadHandler.name)

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly photoWriteRepo: IPhotoWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
    @Inject(KV_STORAGE_ADAPTER) private readonly kv: IKvStorageAdapter,
    @Inject(ORDER_READ_REPOSITORY) private readonly orderReadRepo: IOrderReadRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: ConfirmRetouchedUploadCommand): Promise<{ confirmed: boolean }> {
    const photo = await this.photoReadRepo.findById(command.photoId)
    if (!photo) throw AppException.notFound('Photo', command.photoId)

    const expectedPrefix = `events/${photo.eventId}/retouched/`
    if (!command.objectKey.startsWith(expectedPrefix)) {
      throw AppException.businessRule('photo.invalid_object_key_prefix')
    }

    // Clean up old retouched file and its KV slug
    if (photo.retouchedStorageKey) {
      try {
        await this.storage.delete(photo.retouchedStorageKey)
      } catch (error) {
        this.logger.warn(`Failed to delete old retouched file: ${photo.retouchedStorageKey}`, error)
      }
    }
    if (photo.retouchedPublicSlug) {
      this.kv.delete(photo.retouchedPublicSlug).catch((error) => {
        this.logger.warn(
          `Failed to delete old retouched KV slug: ${photo.retouchedPublicSlug}`,
          error,
        )
      })
    }

    // Generate slug and register in KV
    const retouchedSlug = nanoid()
    photo.setRetouched(
      command.objectKey,
      retouchedSlug,
      BigInt(command.fileSize),
      command.retouchedById,
    )
    await this.photoWriteRepo.save(photo)

    // Register slug → storage key in KV (fire-and-forget)
    this.kv.write(retouchedSlug, command.objectKey).catch((err: unknown) => {
      this.logger.error(`Failed to register retouched KV slug: ${retouchedSlug}`, err)
    })

    const completedOrders = await this.orderReadRepo.findOrdersFullyRetouchedByPhoto(
      command.photoId,
    )

    completedOrders
      .map<OrderRetouchCompletedPayload>((order) => ({
        orderId: order.orderId,
        eventId: order.eventId,
        eventName: order.eventName,
        customerName: order.customerName,
        photoCount: order.photoCount,
        completedAt: new Date(),
      }))
      .forEach((payload) => {
        this.eventEmitter.emit(NotificationEvent.ORDER_RETOUCH_COMPLETED, payload)
        this.logger.log(
          `Order ${payload.orderId} retouch completed — all ${payload.photoCount} photos retouched`,
        )
      })

    return { confirmed: true }
  }
}
