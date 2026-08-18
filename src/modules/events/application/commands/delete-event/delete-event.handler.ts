import {
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventReadRepository,
  type IEventWriteRepository,
} from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { DeleteEventCommand } from './delete-event.command'

@CommandHandler(DeleteEventCommand)
export class DeleteEventHandler implements ICommandHandler<DeleteEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /** Verifies the event exists and archives it (soft-delete). */
  async execute(command: DeleteEventCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.id)
    if (!event) throw AppException.notFound('Event', command.id)

    await this.authz.assert(command.userId, 'event.delete', event.id)

    event.archive()
    await this.writeRepo.save(event)

    return { id: event.id }
  }
}
