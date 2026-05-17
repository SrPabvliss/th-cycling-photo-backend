import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { ForbiddenException, Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { PaginatedResult } from '@shared/application'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { toOperatorReviewQueueItemProjection } from '../../../infrastructure/mappers/operator-review-queue-item.mapper'
import type { OperatorReviewQueueItemProjection } from '../../projections'
import { GetOperatorReviewQueueQuery } from './get-review-queue.query'

@QueryHandler(GetOperatorReviewQueueQuery)
export class GetOperatorReviewQueueHandler implements IQueryHandler<GetOperatorReviewQueueQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY)
    private readonly eventRead: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY)
    private readonly photoRead: IPhotoReadRepository,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async execute(
    query: GetOperatorReviewQueueQuery,
  ): Promise<PaginatedResult<OperatorReviewQueueItemProjection>> {
    const assignedIds = await this.eventRead.getAssignedEventIdsByStatus(query.operatorId, 'active')

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

    const { items, total } = await this.photoRead.getReviewQueueByEventIds({
      eventIds: eventIdsForQuery,
      status: query.status,
      limit: query.pagination.take,
      offset: query.pagination.skip,
    })

    const uniqueEventIds = Array.from(new Set(items.map((it) => it.eventId)))
    const briefs = await this.eventRead.getEventBriefsByIds(uniqueEventIds)
    const briefsById = new Map(briefs.map((b) => [b.id, b]))

    const projected = items.map((row) =>
      toOperatorReviewQueueItemProjection(row, briefsById.get(row.eventId), this.cdn),
    )

    return new PaginatedResult(projected, total, query.pagination)
  }
}
