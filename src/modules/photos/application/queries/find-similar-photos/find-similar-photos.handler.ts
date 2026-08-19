import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import type { SimilarPhotoProjection } from '../../projections'
import { FindSimilarPhotosQuery } from './find-similar-photos.query'

@QueryHandler(FindSimilarPhotosQuery)
export class FindSimilarPhotosHandler implements IQueryHandler<FindSimilarPhotosQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /**
   * The source photo is loaded scoped, so an out-of-scope id 404s. Once it resolves its event is
   * in scope by definition, so `findSimilar` — a same-event query — needs no filter of its own.
   */
  async execute(query: FindSimilarPhotosQuery): Promise<SimilarPhotoProjection[]> {
    const scope = await this.authz.resolveEventScope(query.userId)
    const photo = await this.photoReadRepo.findByIdInScope(query.photoId, scope)
    if (!photo) throw AppException.notFound('Photo', query.photoId)

    return this.photoReadRepo.findSimilar(query.photoId, photo.eventId, query.limit)
  }
}
