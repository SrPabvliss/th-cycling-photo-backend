import {
  EVENT_OPERATOR_REPOSITORY,
  type IEventOperatorRepository,
} from '@events/domain/ports/event-operator-repository.port'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { UnassignOperatorCommand } from './unassign-operator.command'

@CommandHandler(UnassignOperatorCommand)
export class UnassignOperatorHandler implements ICommandHandler<UnassignOperatorCommand> {
  constructor(
    @Inject(EVENT_OPERATOR_REPOSITORY) private readonly operatorRepo: IEventOperatorRepository,
  ) {}

  async execute(command: UnassignOperatorCommand): Promise<void> {
    const isAssigned = await this.operatorRepo.isAssigned(command.eventId, command.userId)
    if (!isAssigned) {
      throw AppException.notFound('EventOperator', `${command.eventId}/${command.userId}`)
    }

    await this.operatorRepo.unassign(command.eventId, command.userId)
  }
}
