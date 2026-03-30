import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  type IPhotoCategoryReadRepository,
  PHOTO_CATEGORY_READ_REPOSITORY,
} from '../../../domain/ports'
import type { PhotoCategoryProjection } from '../../projections'
import { GetAllCategoriesQuery } from './get-all-categories.query'

@QueryHandler(GetAllCategoriesQuery)
export class GetAllCategoriesHandler implements IQueryHandler<GetAllCategoriesQuery> {
  constructor(
    @Inject(PHOTO_CATEGORY_READ_REPOSITORY) private readonly readRepo: IPhotoCategoryReadRepository,
  ) {}

  async execute(_query: GetAllCategoriesQuery): Promise<PhotoCategoryProjection[]> {
    return this.readRepo.getAll()
  }
}
