import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PhotoListProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { GetPhotosListQuery } from './get-photos-list.query'

@QueryHandler(GetPhotosListQuery)
export class GetPhotosListHandler implements IQueryHandler<GetPhotosListQuery> {
  constructor(@Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository) {}

  /** Retrieves a paginated list of photos for a given event. */
  async execute(query: GetPhotosListQuery): Promise<PhotoListProjection[]> {
    return this.readRepo.getPhotosList(query.eventId, query.pagination)
  }
}
