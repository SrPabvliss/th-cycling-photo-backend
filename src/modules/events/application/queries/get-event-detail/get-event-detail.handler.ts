import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '../../../../../shared/domain/exceptions/app.exception.js'
import {
  EVENT_READ_REPOSITORY,
  type IEventReadRepository,
} from '../../../domain/ports/event-read-repository.port.js'
import type { EventDetailProjection } from '../../projections/event-detail.projection.js'
import { GetEventDetailQuery } from './get-event-detail.query.js'

@QueryHandler(GetEventDetailQuery)
export class GetEventDetailHandler implements IQueryHandler<GetEventDetailQuery> {
  constructor(@Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository) {}

  /** Retrieves a single event's detail or throws 404. */
  async execute(query: GetEventDetailQuery): Promise<EventDetailProjection> {
    const event = await this.readRepo.getEventDetail(query.id)
    if (!event) throw AppException.notFound('Event', query.id)

    return event
  }
}
