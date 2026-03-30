import { EventsModule } from '@events/events.module'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { AssignCategoryToEventHandler } from './application/commands/assign-category-to-event/assign-category-to-event.handler'
import { CreatePhotoCategoryHandler } from './application/commands/create-photo-category/create-photo-category.handler'
import { UnassignCategoryFromEventHandler } from './application/commands/unassign-category-from-event/unassign-category-from-event.handler'
import { GetAllCategoriesHandler } from './application/queries/get-all-categories/get-all-categories.handler'
import { GetPhotoCategoriesHandler } from './application/queries/get-photo-categories/get-photo-categories.handler'
import { PHOTO_CATEGORY_READ_REPOSITORY, PHOTO_CATEGORY_WRITE_REPOSITORY } from './domain/ports'
import { PhotoCategoryReadRepository } from './infrastructure/repositories/photo-category-read.repository'
import { PhotoCategoryWriteRepository } from './infrastructure/repositories/photo-category-write.repository'
import { PhotoCategoriesController } from './presentation/controllers/photo-categories.controller'

const CommandHandlers = [
  CreatePhotoCategoryHandler,
  AssignCategoryToEventHandler,
  UnassignCategoryFromEventHandler,
]
const QueryHandlers = [GetAllCategoriesHandler, GetPhotoCategoriesHandler]

@Module({
  imports: [CqrsModule, EventsModule],
  controllers: [PhotoCategoriesController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: PHOTO_CATEGORY_READ_REPOSITORY, useClass: PhotoCategoryReadRepository },
    { provide: PHOTO_CATEGORY_WRITE_REPOSITORY, useClass: PhotoCategoryWriteRepository },
  ],
  exports: [PHOTO_CATEGORY_READ_REPOSITORY],
})
export class PhotoCategoriesModule {}
