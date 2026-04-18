import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PhotoViewProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { GetPhotoViewQuery } from './get-photo-view.query'

@QueryHandler(GetPhotoViewQuery)
export class GetPhotoViewHandler implements IQueryHandler<GetPhotoViewQuery> {
  constructor(@Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository) {}

  async execute(query: GetPhotoViewQuery): Promise<PhotoViewProjection> {
    const photo = await this.readRepo.getPhotoViewBySlug(query.slug)
    if (!photo) throw AppException.notFound('Photo', query.slug)
    return photo
  }
}
