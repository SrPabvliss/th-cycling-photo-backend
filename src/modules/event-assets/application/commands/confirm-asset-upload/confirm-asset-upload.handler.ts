import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
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
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly freeze: FreezeStateService,
  ) {}

  async execute(command: ConfirmAssetUploadCommand): Promise<EntityIdProjection> {
    if (command.assetType !== 'cover_image') {
      throw AppException.businessRule('event_asset.unsupported_type')
    }

    const scope = await this.authz.resolveEventScope(command.userId)
    const event = await this.eventReadRepo.findByIdInScope(command.eventId, scope)
    if (!event) throw AppException.notFound('Event', command.eventId)
    await this.authz.assert(command.userId, 'event_asset.confirm', event.id)
    await this.freeze.assertNotFrozen(command.eventId)

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
      focalX: command.focalX,
      focalY: command.focalY,
    })

    // The Worker resolves assets by slug and never reads the database, so the storage key travels
    // through KV. Publishing before persisting keeps the two in step: a KV failure leaves no row
    // pointing at a slug the CDN cannot serve, and the upload can be retried. The reverse order
    // used to swallow the error and hand back a cover nobody could load. The crop origin does not
    // go here — it rides in the image URL, where a change is visible immediately.
    await this.kvStorage.write(asset.publicSlug, asset.storageKey)

    const saved = await this.writeRepo.save(asset)

    return { id: saved.id }
  }
}
