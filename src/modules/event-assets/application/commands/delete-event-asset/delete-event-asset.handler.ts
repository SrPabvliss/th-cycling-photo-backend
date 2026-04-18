import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
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
    @Inject(EVENT_ASSET_READ_REPOSITORY) private readonly readRepo: IEventAssetReadRepository,
    @Inject(EVENT_ASSET_WRITE_REPOSITORY) private readonly writeRepo: IEventAssetWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
    @Inject(KV_STORAGE_ADAPTER) private readonly kvStorage: IKvStorageAdapter,
  ) {}

  async execute(command: DeleteEventAssetCommand): Promise<void> {
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
