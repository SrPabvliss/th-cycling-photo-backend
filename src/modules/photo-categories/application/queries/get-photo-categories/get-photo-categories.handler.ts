import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  type IPhotoCategoryReadRepository,
  PHOTO_CATEGORY_READ_REPOSITORY,
} from '../../../domain/ports'
import type { PhotoCategoryProjection } from '../../projections'
import { GetPhotoCategoriesQuery } from './get-photo-categories.query'

@QueryHandler(GetPhotoCategoriesQuery)
export class GetPhotoCategoriesHandler implements IQueryHandler<GetPhotoCategoriesQuery> {
  constructor(
    @Inject(PHOTO_CATEGORY_READ_REPOSITORY) private readonly readRepo: IPhotoCategoryReadRepository,
  ) {}

  async execute(query: GetPhotoCategoriesQuery): Promise<PhotoCategoryProjection[]> {
    return this.readRepo.getByEvent(query.eventId)
  }
}
