import {
  EVENT_OPERATOR_REPOSITORY,
  type EventOperatorProjection,
  type IEventOperatorRepository,
} from '@events/domain/ports/event-operator-repository.port'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { GetEventOperatorsQuery } from './get-event-operators.query'

@QueryHandler(GetEventOperatorsQuery)
export class GetEventOperatorsHandler implements IQueryHandler<GetEventOperatorsQuery> {
  constructor(
    @Inject(EVENT_OPERATOR_REPOSITORY) private readonly operatorRepo: IEventOperatorRepository,
  ) {}

  async execute(query: GetEventOperatorsQuery): Promise<EventOperatorProjection[]> {
    return this.operatorRepo.findByEvent(query.eventId)
  }
}
