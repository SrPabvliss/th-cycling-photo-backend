import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { GalleryFacetsProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { GetGalleryFacetsQuery } from './get-gallery-facets.query'

@QueryHandler(GetGalleryFacetsQuery)
export class GetGalleryFacetsHandler implements IQueryHandler<GetGalleryFacetsQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /** Retrieves event-wide facet counts for the gallery filter panel, scoped to the caller. */
  async execute(query: GetGalleryFacetsQuery): Promise<GalleryFacetsProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)
    return this.readRepo.getGalleryFacets(query.eventId, scope)
  }
}
