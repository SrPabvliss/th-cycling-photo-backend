import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '../../../../../shared/application/projections/entity-id.projection.js'
import { AppException } from '../../../../../shared/domain/exceptions/app.exception.js'
import {
  EVENT_READ_REPOSITORY,
  type IEventReadRepository,
} from '../../../domain/ports/event-read-repository.port.js'
import {
  EVENT_WRITE_REPOSITORY,
  type IEventWriteRepository,
} from '../../../domain/ports/event-write-repository.port.js'
import { UpdateEventCommand } from './update-event.command.js'

@CommandHandler(UpdateEventCommand)
export class UpdateEventHandler implements ICommandHandler<UpdateEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
  ) {}

  /** Loads an event, applies updates, and persists it. */
  async execute(command: UpdateEventCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.id)

    if (!event) {
      throw AppException.notFound('Event', command.id)
    }

    event.update({
      name: command.name,
      date: command.date,
      location: command.location,
    })

    await this.writeRepo.save(event)

    return { id: event.id }
  }
}
