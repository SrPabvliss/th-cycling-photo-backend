import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { ForbiddenException, Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PaginatedResult } from '@shared/application'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
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
  ) {}

  async execute(
    query: GetOperatorRetouchOrdersQuery,
  ): Promise<PaginatedResult<OperatorRetouchOrderProjection>> {
    const assignedIds = await this.eventRead.getAllAssignedEventIds(query.operatorId)

    if (assignedIds.length === 0) {
      return new PaginatedResult([], 0, query.pagination)
    }

    let eventIdsForQuery = assignedIds
    if (query.eventSlug) {
      const event = await this.eventRead.existsActiveEventBySlug(query.eventSlug)
      if (!event || !assignedIds.includes(event.id)) {
        throw new ForbiddenException('operator.not_assigned_to_event')
      }
      eventIdsForQuery = [event.id]
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
