import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PhotoDetailProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetPhotoDetailQuery } from './get-photo-detail.query'

@QueryHandler(GetPhotoDetailQuery)
export class GetPhotoDetailHandler implements IQueryHandler<GetPhotoDetailQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /**
   * A photo's detail with classification data, or 404 — including when the photo exists but its
   * event is out of scope, so an out-of-scope id is indistinguishable from an unknown one.
   */
  async execute(query: GetPhotoDetailQuery): Promise<PhotoDetailProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)
    const photo = await this.readRepo.getPhotoDetail(query.id, scope)
    if (!photo) throw AppException.notFound('entities.photo', query.id)

    return photo
  }
}
