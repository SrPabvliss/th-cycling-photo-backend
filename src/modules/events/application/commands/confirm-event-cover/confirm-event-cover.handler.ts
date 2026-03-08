import {
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventReadRepository,
  type IEventWriteRepository,
} from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { ConfirmEventCoverCommand } from './confirm-event-cover.command'

@CommandHandler(ConfirmEventCoverCommand)
export class ConfirmEventCoverHandler implements ICommandHandler<ConfirmEventCoverCommand> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  /** Confirms a cover image upload and updates the event entity. */
  async execute(command: ConfirmEventCoverCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    const expectedPrefix = `events/${command.eventId}/cover/`
    if (!command.storageKey.startsWith(expectedPrefix)) {
      throw AppException.businessRule('event.invalid_cover_storage_key')
    }

    // Delete old cover from storage if replacing
    if (event.coverImageStorageKey && event.coverImageStorageKey !== command.storageKey) {
      await this.storage.delete(event.coverImageStorageKey)
    }

    const url = this.storage.getPublicUrl(command.storageKey)
    event.setCoverImage(url, command.storageKey)
    await this.writeRepo.save(event)

    return { id: event.id }
  }
}
