import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '../../../../../shared/domain/exceptions/app.exception.js'
import type { EventWriteRepository } from '../../../infrastructure/repositories/event-write.repository.js'
import { UpdateEventCommand } from './update-event.command.js'

@CommandHandler(UpdateEventCommand)
export class UpdateEventHandler implements ICommandHandler<UpdateEventCommand> {
  constructor(private readonly eventRepository: EventWriteRepository) {}

  /** Loads an event, applies updates, and persists it. */
  async execute(command: UpdateEventCommand): Promise<{ id: string }> {
    const event = await this.eventRepository.findById(command.id)

    if (!event) {
      throw AppException.notFound('Event', command.id)
    }

    event.update({
      name: command.name,
      date: command.date,
      location: command.location,
    })

    await this.eventRepository.save(event)

    return { id: event.id }
  }
}
