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
import { RestoreEventCommand } from './restore-event.command'

@CommandHandler(RestoreEventCommand)
export class RestoreEventHandler implements ICommandHandler<RestoreEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
  ) {}

  /** Restores an archived event back to active status. */
  async execute(command: RestoreEventCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.id, true)
    if (!event) throw AppException.notFound('Event', command.id)

    event.restore()
    await this.writeRepo.save(event)

    return { id: event.id }
  }
}
