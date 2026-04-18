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
import { ArchiveEventCommand } from './archive-event.command'

@CommandHandler(ArchiveEventCommand)
export class ArchiveEventHandler implements ICommandHandler<ArchiveEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
  ) {}

  /** Archives an event by setting its status and soft-deleting it. */
  async execute(command: ArchiveEventCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.id)
    if (!event) throw AppException.notFound('Event', command.id)

    event.archive()
    await this.writeRepo.save(event)

    return { id: event.id }
  }
}
