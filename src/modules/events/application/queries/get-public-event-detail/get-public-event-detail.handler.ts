import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import type { PublicEventDetailProjection } from '../../projections'
import { GetPublicEventDetailQuery } from './get-public-event-detail.query'

@QueryHandler(GetPublicEventDetailQuery)
export class GetPublicEventDetailHandler implements IQueryHandler<GetPublicEventDetailQuery> {
  constructor(@Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository) {}

  async execute(query: GetPublicEventDetailQuery): Promise<PublicEventDetailProjection> {
    const event = await this.readRepo.getPublicEventDetail(query.eventId)
    if (!event) throw AppException.notFound('Event', query.eventId)
    return event
  }
}
