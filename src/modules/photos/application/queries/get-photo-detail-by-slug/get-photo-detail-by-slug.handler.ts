import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PhotoDetailProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { GetPhotoDetailBySlugQuery } from './get-photo-detail-by-slug.query'

@QueryHandler(GetPhotoDetailBySlugQuery)
export class GetPhotoDetailBySlugHandler implements IQueryHandler<GetPhotoDetailBySlugQuery> {
  constructor(@Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository) {}

  async execute(query: GetPhotoDetailBySlugQuery): Promise<PhotoDetailProjection> {
    const photo = await this.readRepo.getPhotoDetailBySlug(query.slug)
    if (!photo) throw AppException.notFound('Photo', query.slug)
    return photo
  }
}
