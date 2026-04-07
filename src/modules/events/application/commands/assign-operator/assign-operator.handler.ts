import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import {
  EVENT_OPERATOR_REPOSITORY,
  type IEventOperatorRepository,
} from '@events/domain/ports/event-operator-repository.port'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { AssignOperatorCommand } from './assign-operator.command'

@CommandHandler(AssignOperatorCommand)
export class AssignOperatorHandler implements ICommandHandler<AssignOperatorCommand> {
  constructor(
    @Inject(EVENT_OPERATOR_REPOSITORY) private readonly operatorRepo: IEventOperatorRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
  ) {}

  async execute(command: AssignOperatorCommand): Promise<void> {
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    const alreadyAssigned = await this.operatorRepo.isAssigned(command.eventId, command.userId)
    if (alreadyAssigned) {
      throw AppException.businessRule('event.operator_already_assigned')
    }

    await this.operatorRepo.assign(command.eventId, command.userId, command.assignedById)
  }
}
