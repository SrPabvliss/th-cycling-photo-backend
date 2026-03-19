import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import type { SimilarPhotoProjection } from '../../projections'
import { FindSimilarPhotosQuery } from './find-similar-photos.query'

@QueryHandler(FindSimilarPhotosQuery)
export class FindSimilarPhotosHandler implements IQueryHandler<FindSimilarPhotosQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
  ) {}

  async execute(query: FindSimilarPhotosQuery): Promise<SimilarPhotoProjection[]> {
    const photo = await this.photoReadRepo.findById(query.photoId)
    if (!photo) throw AppException.notFound('Photo', query.photoId)

    return this.photoReadRepo.findSimilar(query.photoId, photo.eventId, query.limit)
  }
}
