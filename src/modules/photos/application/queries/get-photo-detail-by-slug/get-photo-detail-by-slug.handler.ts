import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PhotoDetailProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetPhotoDetailBySlugQuery } from './get-photo-detail-by-slug.query'

@QueryHandler(GetPhotoDetailBySlugQuery)
export class GetPhotoDetailBySlugHandler implements IQueryHandler<GetPhotoDetailBySlugQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(query: GetPhotoDetailBySlugQuery): Promise<PhotoDetailProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)
    const photo = await this.readRepo.getPhotoDetailBySlug(query.slug, scope)
    if (!photo) throw AppException.notFound('entities.photo', query.slug)
    return photo
  }
}
