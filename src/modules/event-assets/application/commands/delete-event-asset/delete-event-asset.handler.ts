import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
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
  constructor(
    @Inject(EVENT_ASSET_READ_REPOSITORY) private readonly readRepo: IEventAssetReadRepository,
    @Inject(EVENT_ASSET_WRITE_REPOSITORY) private readonly writeRepo: IEventAssetWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async execute(command: DeleteEventAssetCommand): Promise<void> {
    const asset = await this.readRepo.findByEventAndType(command.eventId, command.assetType)
    if (!asset) throw AppException.notFound('EventAsset', command.assetType)

    await this.storage.delete(asset.storageKey)
    await this.writeRepo.delete(asset.id)
  }
}
