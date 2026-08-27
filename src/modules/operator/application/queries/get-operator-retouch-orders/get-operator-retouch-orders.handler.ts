import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PaginatedResult } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { AppException } from '@shared/domain'
import {
  type IOperatorRetouchReadRepository,
  OPERATOR_RETOUCH_READ_REPOSITORY,
} from '../../../domain/ports'
import { toOperatorRetouchOrdersList } from '../../../infrastructure/mappers/operator-retouch-orders.mapper'
import type { OperatorRetouchOrderProjection } from '../../projections'
import { GetOperatorRetouchOrdersQuery } from './get-operator-retouch-orders.query'

@QueryHandler(GetOperatorRetouchOrdersQuery)
export class GetOperatorRetouchOrdersHandler
  implements IQueryHandler<GetOperatorRetouchOrdersQuery>
{
  constructor(
    @Inject(EVENT_READ_REPOSITORY)
    private readonly eventRead: IEventReadRepository,
    @Inject(OPERATOR_RETOUCH_READ_REPOSITORY)
    private readonly retouchRead: IOperatorRetouchReadRepository,
    private readonly cdn: CdnUrlBuilder,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(
    query: GetOperatorRetouchOrdersQuery,
  ): Promise<PaginatedResult<OperatorRetouchOrderProjection>> {
    const isAdmin = await this.authz.can(query.operatorId, 'event.read.all')

    let eventIdsForQuery: string[] | null = null
    if (isAdmin) {
      if (query.eventSlug) {
        const event = await this.eventRead.existsActiveEventBySlug(query.eventSlug)
        if (!event) throw AppException.notFound('Event', query.eventSlug)
        eventIdsForQuery = [event.id]
      }
    } else {
      const assignedIds = await this.eventRead.getAllAssignedEventIds(query.operatorId)
      if (assignedIds.length === 0) {
        return new PaginatedResult([], 0, query.pagination)
      }
      eventIdsForQuery = assignedIds
      if (query.eventSlug) {
        const event = await this.eventRead.existsActiveEventBySlug(query.eventSlug)
        if (!event || !assignedIds.includes(event.id)) {
          throw AppException.forbidden('operator.not_assigned_to_event')
        }
        eventIdsForQuery = [event.id]
      }
    }

    const { items, total } = await this.retouchRead.findOperatorRetouchOrdersPage(
      eventIdsForQuery,
      query.scope,
      query.pagination.skip,
      query.pagination.take,
    )

    const projected = toOperatorRetouchOrdersList(items, this.cdn)

    return new PaginatedResult(projected, total, query.pagination)
  }
}
