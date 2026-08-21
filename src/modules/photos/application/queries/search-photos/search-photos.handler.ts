import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PhotoListProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { PaginatedResult } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { SearchPhotosQuery } from './search-photos.query'

@QueryHandler(SearchPhotosQuery)
export class SearchPhotosHandler implements IQueryHandler<SearchPhotosQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /** Searches photos across events with multi-criteria filtering, scoped to the caller. */
  async execute(query: SearchPhotosQuery): Promise<PaginatedResult<PhotoListProjection>> {
    const scope = await this.authz.resolveEventScope(query.userId)
    return this.readRepo.searchPhotos(query.filters, query.pagination, scope)
  }
}
