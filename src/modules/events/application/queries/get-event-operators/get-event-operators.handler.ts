import {
  EVENT_OPERATOR_REPOSITORY,
  type EventOperatorProjection,
  type IEventOperatorRepository,
} from '@events/domain/ports/event-operator-repository.port'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { GetEventOperatorsQuery } from './get-event-operators.query'

@QueryHandler(GetEventOperatorsQuery)
export class GetEventOperatorsHandler implements IQueryHandler<GetEventOperatorsQuery> {
  constructor(
    @Inject(EVENT_OPERATOR_REPOSITORY) private readonly operatorRepo: IEventOperatorRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(query: GetEventOperatorsQuery): Promise<EventOperatorProjection[]> {
    // Targets a single, already-known event id (unlike the list/detail
    // queries, there is no slug to resolve and no collection to filter) —
    // so this asserts against that id directly, the same shape the
    // mutations below use once they've loaded/verified the entity.
    await this.authz.assert(query.userId, 'event.collaborator.read', query.eventId)

    return this.operatorRepo.findByEvent(query.eventId)
  }
}
