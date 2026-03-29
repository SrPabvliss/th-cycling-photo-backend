import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
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
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(EVENT_ASSET_READ_REPOSITORY) private readonly readRepo: IEventAssetReadRepository,
    @Inject(EVENT_ASSET_WRITE_REPOSITORY) private readonly writeRepo: IEventAssetWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(command: ConfirmAssetUploadCommand): Promise<EntityIdProjection> {
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    const expectedPrefix = `events/${command.eventId}/assets/${command.assetType}/`
    if (!command.storageKey.startsWith(expectedPrefix)) {
      throw AppException.businessRule('event_asset.invalid_storage_key')
    }

    // Delete old file from B2 if replacing an existing asset
    const existing = await this.readRepo.findByEventAndType(command.eventId, command.assetType)
    if (existing && existing.storageKey !== command.storageKey) {
      await this.storage.delete(existing.storageKey)
    }

    const asset = EventAsset.create({
      eventId: command.eventId,
      assetType: command.assetType,
      storageKey: command.storageKey,
      fileSize: command.fileSize,
      mimeType: command.mimeType,
    })

    const saved = await this.writeRepo.save(asset)
    return { id: saved.id }
  }
}
