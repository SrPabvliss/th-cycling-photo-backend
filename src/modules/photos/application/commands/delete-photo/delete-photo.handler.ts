import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import {
  type IPhotoReadRepository,
  type IPhotoWriteRepository,
  PHOTO_READ_REPOSITORY,
  PHOTO_WRITE_REPOSITORY,
} from '@photos/domain/ports'
import {
  type IPreviewLinkReadRepository,
  PREVIEW_LINK_READ_REPOSITORY,
} from '@previews/domain/ports'
import { type IKvStorageAdapter, KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { DeletePhotoCommand } from './delete-photo.command'

@CommandHandler(DeletePhotoCommand)
export class DeletePhotoHandler implements ICommandHandler<DeletePhotoCommand> {
  private readonly logger = new Logger(DeletePhotoHandler.name)

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoRead: IPhotoReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly photoWrite: IPhotoWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
    @Inject(KV_STORAGE_ADAPTER) private readonly kv: IKvStorageAdapter,
    @Inject(ORDER_READ_REPOSITORY) private readonly orderRead: IOrderReadRepository,
    @Inject(PREVIEW_LINK_READ_REPOSITORY) private readonly previewRead: IPreviewLinkReadRepository,
  ) {}

  async execute(command: DeletePhotoCommand): Promise<void> {
    const photo = await this.photoRead.findById(command.photoId)
    if (!photo) throw AppException.notFound('Photo', command.photoId)

    const [inOrder, inPreview] = await Promise.all([
      this.orderRead.existsByPhotoId(command.photoId),
      this.previewRead.existsByPhotoId(command.photoId),
    ])
    if (inOrder || inPreview) {
      throw AppException.businessRule('photo.delete_blocked_referenced')
    }

    // DB first: cascade removes processings, detections, bibs, colors, corrections, cart items, embedding.
    await this.photoWrite.delete(photo.id)

    // Best-effort object cleanup (the row is already gone; log and continue on failure).
    await this.deleteObject(photo.storageKey)
    if (photo.retouchedStorageKey) await this.deleteObject(photo.retouchedStorageKey)

    this.deleteSlug(photo.publicSlug)
    if (photo.retouchedPublicSlug) this.deleteSlug(photo.retouchedPublicSlug)
  }

  private async deleteObject(key: string): Promise<void> {
    try {
      await this.storage.delete(key)
    } catch (error) {
      this.logger.warn(
        `Failed to delete storage object ${key} after photo deletion — continuing`,
        error,
      )
    }
  }

  private deleteSlug(slug: string): void {
    this.kv.delete(slug).catch((error) => {
      this.logger.warn(`Failed to delete KV slug ${slug} after photo deletion — continuing`, error)
    })
  }
}
