import { EventDetailProjection } from '@events/application/projections'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetEventDetailQuery } from './get-event-detail.query'

@QueryHandler(GetEventDetailQuery)
export class GetEventDetailHandler implements IQueryHandler<GetEventDetailQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(query: GetEventDetailQuery): Promise<EventDetailProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)

    // An out-of-scope slug resolves to no record here, so it 404s like any
    // other unknown slug — the caller must not be able to learn that an
    // event exists by probing slugs. Do not turn this into a 403.
    const event = await this.readRepo.getEventDetailBySlug(query.slug, scope)
    if (!event) throw AppException.notFound('entities.event', query.slug)

    const [totalFileSize, classifiedCount, aggregate] = await Promise.all([
      this.photoReadRepo.getTotalFileSizeByEvent(event.id),
      this.photoReadRepo.getClassifiedCountByEvent(event.id),
      this.readRepo.getAggregateByEvent(event.id),
    ])

    event.totalFileSize = totalFileSize
    event.classifiedCount = classifiedCount
    event.reviewedCount = aggregate.reviewedCount
    event.categorizedCount = aggregate.categorizedCount
    event.lastUploadAt = aggregate.lastUploadAt
    event.revenue = aggregate.revenue
    event.soldPhotoCount = aggregate.soldPhotoCount
    event.ordersCount =
      aggregate.paidCount +
      aggregate.deliveredCount +
      aggregate.giftedCount +
      aggregate.unpaidCount +
      aggregate.cancelledCount

    return event
  }
}
