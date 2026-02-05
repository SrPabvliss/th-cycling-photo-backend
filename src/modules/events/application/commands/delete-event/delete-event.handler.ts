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
import { DeleteEventCommand } from './delete-event.command.js'

@CommandHandler(DeleteEventCommand)
export class DeleteEventHandler implements ICommandHandler<DeleteEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
  ) {}

  /** Verifies the event exists and deletes it. */
  async execute(command: DeleteEventCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.id)
    if (!event) throw AppException.notFound('Event', command.id)

    await this.writeRepo.delete(command.id)

    return { id: command.id }
  }
}
