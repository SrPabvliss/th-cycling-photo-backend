import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PaginatedResult } from '@shared/application'
import { AppException } from '@shared/domain'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '../../../domain/ports'
import type { PublicPhotoProjection } from '../../projections'
import { GetPublicEventPhotosQuery } from './get-public-event-photos.query'

@QueryHandler(GetPublicEventPhotosQuery)
export class GetPublicEventPhotosHandler implements IQueryHandler<GetPublicEventPhotosQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
  ) {}

  async execute(query: GetPublicEventPhotosQuery): Promise<PaginatedResult<PublicPhotoProjection>> {
    // Validate event exists and is active
    const event = await this.eventReadRepo.existsActiveEvent(query.eventId)
    if (!event) throw AppException.notFound('entities.event', query.eventId)

    return this.eventReadRepo.getPublicPhotos(
      query.eventId,
      query.pagination,
      query.photoCategoryId,
    )
  }
}
