import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '../../../../../shared/application/projections/entity-id.projection.js'
import { Event } from '../../../domain/entities/event.entity.js'
import {
  EVENT_WRITE_REPOSITORY,
  type IEventWriteRepository,
} from '../../../domain/ports/event-write-repository.port.js'
import { CreateEventCommand } from './create-event.command.js'

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(@Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository) {}

  /** Creates a new event entity and persists it. */
  async execute(command: CreateEventCommand): Promise<EntityIdProjection> {
    const event = Event.create({
      name: command.name,
      date: command.date,
      location: command.location,
    })

    const saved = await this.writeRepo.save(event)

    return { id: saved.id }
  }
}
