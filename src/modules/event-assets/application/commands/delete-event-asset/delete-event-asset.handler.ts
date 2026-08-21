import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { type IKvStorageAdapter, KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import {
  EVENT_ASSET_READ_REPOSITORY,
  EVENT_ASSET_WRITE_REPOSITORY,
  type IEventAssetReadRepository,
  type IEventAssetWriteRepository,
} from '../../../domain/ports'
import { DeleteEventAssetCommand } from './delete-event-asset.command'

@CommandHandler(DeleteEventAssetCommand)
export class DeleteEventAssetHandler implements ICommandHandler<DeleteEventAssetCommand> {
  private readonly logger = new Logger(DeleteEventAssetHandler.name)

  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(EVENT_ASSET_READ_REPOSITORY) private readonly readRepo: IEventAssetReadRepository,
    @Inject(EVENT_ASSET_WRITE_REPOSITORY) private readonly writeRepo: IEventAssetWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
    @Inject(KV_STORAGE_ADAPTER) private readonly kvStorage: IKvStorageAdapter,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly freeze: FreezeStateService,
  ) {}

  async execute(command: DeleteEventAssetCommand): Promise<void> {
    // Scoped load, then assert — see Ruling 21. `EventAsset` itself
    // carries no tenant of its own; its parent Event does, so the
    // tenant-boundary check happens against the scoped Event load.
    const scope = await this.authz.resolveEventScope(command.userId)
    const event = await this.eventReadRepo.findByIdInScope(command.eventId, scope)
    if (!event) throw AppException.notFound('Event', command.eventId)
    await this.authz.assert(command.userId, 'event_asset.delete', event.id)
    await this.freeze.assertNotFrozen(command.eventId)

    const asset = await this.readRepo.findByEventAndType(command.eventId, command.assetType)
    if (!asset) throw AppException.notFound('EventAsset', command.assetType)

    await this.storage.delete(asset.storageKey)
    await this.writeRepo.delete(asset.id)

    await this.kvStorage.delete(asset.publicSlug).catch((err) => {
      this.logger.error(
        `Failed to delete KV slug ${asset.publicSlug} after asset deletion — continuing`,
        err,
      )
    })
  }
}
