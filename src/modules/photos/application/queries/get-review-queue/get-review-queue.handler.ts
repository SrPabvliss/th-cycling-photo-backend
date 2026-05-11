import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { ReviewQueueItemProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { PaginatedResult } from '@shared/application'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { GetReviewQueueQuery } from './get-review-queue.query'

@QueryHandler(GetReviewQueueQuery)
export class GetReviewQueueHandler implements IQueryHandler<GetReviewQueueQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async execute(query: GetReviewQueueQuery): Promise<PaginatedResult<ReviewQueueItemProjection>> {
    const { items, total } = await this.readRepo.getReviewQueue({
      eventSlug: query.eventSlug,
      status: query.status,
      limit: query.pagination.take,
      offset: query.pagination.skip,
    })

    const mapped = items.map((item) => ({
      id: item.id,
      publicSlug: item.publicSlug,
      filename: item.filename,
      thumbnailUrl: this.cdn.internalUrl(item.publicSlug, 'thumb'),
      status: item.status,
      reviewedAt: item.reviewedAt,
      minBibConfidence: item.minBibConfidence,
      bibsCount: item.bibsCount,
      colorsCount: item.colorsCount,
    }))

    return new PaginatedResult(mapped, total, query.pagination)
  }
}
