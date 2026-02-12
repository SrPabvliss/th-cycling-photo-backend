import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PhotoListProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { SearchPhotosQuery } from './search-photos.query'

@QueryHandler(SearchPhotosQuery)
export class SearchPhotosHandler implements IQueryHandler<SearchPhotosQuery> {
  constructor(@Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository) {}

  /** Searches photos across events with multi-criteria filtering. */
  async execute(query: SearchPhotosQuery): Promise<PhotoListProjection[]> {
    return this.readRepo.searchPhotos(query.filters, query.pagination)
  }
}
