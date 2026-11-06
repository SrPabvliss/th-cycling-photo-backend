import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import {
  type IOperatorRetouchReadRepository,
  OPERATOR_RETOUCH_READ_REPOSITORY,
} from '../../../domain/ports'
import type { OperatorRetouchEventProjection } from '../../projections'
import { GetRetouchEventsQuery } from './get-retouch-events.query'

/** Active events the caller may retouch in, for the retouch queue's event filter. */
@QueryHandler(GetRetouchEventsQuery)
export class GetRetouchEventsHandler implements IQueryHandler<GetRetouchEventsQuery> {
  constructor(
    @Inject(OPERATOR_RETOUCH_READ_REPOSITORY)
    private readonly retouchRead: IOperatorRetouchReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(query: GetRetouchEventsQuery): Promise<OperatorRetouchEventProjection[]> {
    const scope = await this.authz.resolveEventScope(query.userId, 'photo.retouch.read')
    if (scope.isEmpty) return []
    return this.retouchRead.findRetouchableEvents(scope)
  }
}
