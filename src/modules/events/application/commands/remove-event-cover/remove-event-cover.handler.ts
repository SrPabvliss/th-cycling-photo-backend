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
import { RemoveEventCoverCommand } from './remove-event-cover.command'

@CommandHandler(RemoveEventCoverCommand)
export class RemoveEventCoverHandler implements ICommandHandler<RemoveEventCoverCommand> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  /** Deletes the cover image from B2 and clears the event fields. */
  async execute(command: RemoveEventCoverCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    if (event.coverImageStorageKey) {
      await this.storage.delete(event.coverImageStorageKey)
    }

    event.removeCoverImage()
    await this.writeRepo.save(event)

    return { id: event.id }
  }
}
