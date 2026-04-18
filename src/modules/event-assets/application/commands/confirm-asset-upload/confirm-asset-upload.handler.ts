import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { type IKvStorageAdapter, KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { EventAsset } from '../../../domain/entities'
import {
  EVENT_ASSET_READ_REPOSITORY,
  EVENT_ASSET_WRITE_REPOSITORY,
  type IEventAssetReadRepository,
  type IEventAssetWriteRepository,
} from '../../../domain/ports'
import { ConfirmAssetUploadCommand } from './confirm-asset-upload.command'

@CommandHandler(ConfirmAssetUploadCommand)
export class ConfirmAssetUploadHandler implements ICommandHandler<ConfirmAssetUploadCommand> {
  private readonly logger = new Logger(ConfirmAssetUploadHandler.name)

  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(EVENT_ASSET_READ_REPOSITORY) private readonly readRepo: IEventAssetReadRepository,
    @Inject(EVENT_ASSET_WRITE_REPOSITORY) private readonly writeRepo: IEventAssetWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
    @Inject(KV_STORAGE_ADAPTER) private readonly kvStorage: IKvStorageAdapter,
  ) {}

  async execute(command: ConfirmAssetUploadCommand): Promise<EntityIdProjection> {
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    const expectedPrefix = `events/${command.eventId}/assets/${command.assetType}/`
    if (!command.storageKey.startsWith(expectedPrefix)) {
      throw AppException.businessRule('event_asset.invalid_storage_key')
    }

    // Delete old file from B2 + drop its KV slug if replacing an existing asset
    const existing = await this.readRepo.findByEventAndType(command.eventId, command.assetType)
    if (existing && existing.storageKey !== command.storageKey) {
      await this.storage.delete(existing.storageKey)
      await this.kvStorage.delete(existing.publicSlug).catch((err) => {
        this.logger.error(`Failed to delete stale KV slug ${existing.publicSlug} — continuing`, err)
      })
    }

    const asset = EventAsset.create({
      eventId: command.eventId,
      assetType: command.assetType,
      storageKey: command.storageKey,
      fileSize: command.fileSize,
      mimeType: command.mimeType,
    })

    const saved = await this.writeRepo.save(asset)

    // Register slug→storage_key in Workers KV so the Worker can serve it under /assets/
    await this.kvStorage.write(saved.publicSlug, saved.storageKey).catch((err) => {
      this.logger.error(
        'Failed to write KV mapping for asset — saved but CDN slug not registered',
        err,
      )
    })

    return { id: saved.id }
  }
}
