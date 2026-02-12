import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PhotoDetailProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { GetPhotoDetailQuery } from './get-photo-detail.query'

@QueryHandler(GetPhotoDetailQuery)
export class GetPhotoDetailHandler implements IQueryHandler<GetPhotoDetailQuery> {
  constructor(@Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository) {}

  /** Retrieves a single photo's detail with classification data, or throws 404. */
  async execute(query: GetPhotoDetailQuery): Promise<PhotoDetailProjection> {
    const photo = await this.readRepo.getPhotoDetail(query.id)
    if (!photo) throw AppException.notFound('Photo', query.id)

    return photo
  }
}
