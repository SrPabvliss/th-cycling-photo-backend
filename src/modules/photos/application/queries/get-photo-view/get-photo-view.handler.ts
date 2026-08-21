import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PhotoViewProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetPhotoViewQuery } from './get-photo-view.query'

@QueryHandler(GetPhotoViewQuery)
export class GetPhotoViewHandler implements IQueryHandler<GetPhotoViewQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(query: GetPhotoViewQuery): Promise<PhotoViewProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)
    const photo = await this.readRepo.getPhotoViewBySlug(query.slug, scope)
    if (!photo) throw AppException.notFound('Photo', query.slug)
    return photo
  }
}
