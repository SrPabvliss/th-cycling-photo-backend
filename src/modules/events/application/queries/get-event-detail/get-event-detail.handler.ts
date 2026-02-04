import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '../../../../../shared/domain/exceptions/app.exception.js'
import type { EventReadRepository } from '../../../infrastructure/repositories/event-read.repository.js'
import type { EventDetailProjection } from '../../projections/event-detail.projection.js'
import { GetEventDetailQuery } from './get-event-detail.query.js'

@QueryHandler(GetEventDetailQuery)
export class GetEventDetailHandler implements IQueryHandler<GetEventDetailQuery> {
  constructor(private readonly eventReadRepository: EventReadRepository) {}

  /** Retrieves a single event's detail or throws 404. */
  async execute(query: GetEventDetailQuery): Promise<EventDetailProjection> {
    const event = await this.eventReadRepository.getEventDetail(query.id)

    if (!event) {
      throw AppException.notFound('Event', query.id)
    }

    return event
  }
}
