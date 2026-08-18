import {
  EVENT_OPERATOR_REPOSITORY,
  type IEventOperatorRepository,
} from '@events/domain/ports/event-operator-repository.port'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { UnassignOperatorCommand } from './unassign-operator.command'

@CommandHandler(UnassignOperatorCommand)
export class UnassignOperatorHandler implements ICommandHandler<UnassignOperatorCommand> {
  constructor(
    @Inject(EVENT_OPERATOR_REPOSITORY) private readonly operatorRepo: IEventOperatorRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(command: UnassignOperatorCommand): Promise<void> {
    // No entity load here (unlike the other mutations) — there is nothing
    // beyond the already-known eventId to load, so assert goes straight
    // against it before the existence check below.
    await this.authz.assert(command.unassignedById, 'event.collaborator.unassign', command.eventId)

    const isAssigned = await this.operatorRepo.isAssigned(command.eventId, command.userId)
    if (!isAssigned) {
      throw AppException.notFound('EventOperator', `${command.eventId}/${command.userId}`)
    }

    await this.operatorRepo.unassign(command.eventId, command.userId)
  }
}
