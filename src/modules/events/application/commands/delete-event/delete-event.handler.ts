import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '../../../../../shared/domain/exceptions/app.exception.js'
import type { EventWriteRepository } from '../../../infrastructure/repositories/event-write.repository.js'
import { DeleteEventCommand } from './delete-event.command.js'

@CommandHandler(DeleteEventCommand)
export class DeleteEventHandler implements ICommandHandler<DeleteEventCommand> {
  constructor(private readonly eventRepository: EventWriteRepository) {}

  /** Verifies the event exists and deletes it. */
  async execute(command: DeleteEventCommand): Promise<{ id: string }> {
    const event = await this.eventRepository.findById(command.id)

    if (!event) {
      throw AppException.notFound('Event', command.id)
    }

    await this.eventRepository.delete(command.id)

    return { id: command.id }
  }
}
