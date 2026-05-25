import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PaginatedResult } from '@shared/application'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { AppException } from '@shared/domain'
import {
  type IOperatorRetouchReadRepository,
  OPERATOR_RETOUCH_READ_REPOSITORY,
} from '../../../domain/ports'
import { toRetouchQueueOrdersList } from '../../../infrastructure/mappers/retouch-queue.mapper'
import type { RetouchQueueOrderProjection } from '../../projections'
import { GetRetouchQueueQuery } from './get-retouch-queue.query'

@QueryHandler(GetRetouchQueueQuery)
export class GetRetouchQueueHandler implements IQueryHandler<GetRetouchQueueQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY)
    private readonly eventRead: IEventReadRepository,
    @Inject(OPERATOR_RETOUCH_READ_REPOSITORY)
    private readonly retouchRead: IOperatorRetouchReadRepository,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async execute(
    query: GetRetouchQueueQuery,
  ): Promise<PaginatedResult<RetouchQueueOrderProjection>> {
    const event = await this.eventRead.existsActiveEventBySlug(query.eventSlug)
    if (!event) {
      throw AppException.notFound('Event', query.eventSlug)
    }

    const isAssigned = await this.retouchRead.isOperatorAssigned(event.id, query.operatorId)
    if (!isAssigned) {
      throw AppException.forbidden('operator.not_assigned_to_event')
    }

    const { items, total } = await this.retouchRead.getRetouchQueuePage(
      event.id,
      query.scope,
      query.pagination.skip,
      query.pagination.take,
    )

    const projected = toRetouchQueueOrdersList(items, this.cdn)

    return new PaginatedResult(projected, total, query.pagination)
  }
}
