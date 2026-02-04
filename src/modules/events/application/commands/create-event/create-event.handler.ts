import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '../../../../../shared/application/projections/entity-id.projection.js'
import { Event } from '../../../domain/entities/event.entity.js'
import type { EventWriteRepository } from '../../../infrastructure/repositories/event-write.repository.js'
import { CreateEventCommand } from './create-event.command.js'

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(private readonly eventRepository: EventWriteRepository) {}

  /** Creates a new event entity and persists it. */
  async execute(command: CreateEventCommand): Promise<EntityIdProjection> {
    const event = Event.create({
      name: command.name,
      date: command.date,
      location: command.location,
    })

    const saved = await this.eventRepository.save(event)

    return { id: saved.id }
  }
}
