import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
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
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(command: UnassignOperatorCommand): Promise<void> {
    // Scoped load first — the event must fall inside the caller's tenant
    // scope before we even check assignment. Without this, `assert` alone
    // would pass for any eventId as long as the caller's template grants
    // `event.collaborator.unassign` in general (it never checks tenant_id),
    // letting a tenant unassign an operator from another tenant's event.
    const scope = await this.authz.resolveEventScope(command.unassignedById)
    const event = await this.eventReadRepo.findByIdInScope(command.eventId, scope)
    if (!event) throw AppException.notFound('Event', command.eventId)

    await this.authz.assert(command.unassignedById, 'event.collaborator.unassign', event.id)
    event.assertNotFrozen()

    const isAssigned = await this.operatorRepo.isAssigned(command.eventId, command.userId)
    if (!isAssigned) {
      throw AppException.notFound('EventOperator', `${command.eventId}/${command.userId}`)
    }

    await this.operatorRepo.unassign(command.eventId, command.userId)
  }
}
