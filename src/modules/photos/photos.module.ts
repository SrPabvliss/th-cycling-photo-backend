import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { UploadPhotosHandler } from '@photos/application/commands/upload-photos/upload-photos.handler'
import { GetPhotoDetailHandler } from '@photos/application/queries/get-photo-detail/get-photo-detail.handler'
import { GetPhotosListHandler } from '@photos/application/queries/get-photos-list/get-photos-list.handler'
import { SearchPhotosHandler } from '@photos/application/queries/search-photos/search-photos.handler'
import { PHOTO_READ_REPOSITORY, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import { PhotoReadRepository } from '@photos/infrastructure/repositories/photo-read.repository'
import { PhotoWriteRepository } from '@photos/infrastructure/repositories/photo-write.repository'
import { EventsModule } from '../events/events.module'

const CommandHandlers = [UploadPhotosHandler]
const QueryHandlers = [GetPhotosListHandler, GetPhotoDetailHandler, SearchPhotosHandler]

@Module({
  imports: [CqrsModule, EventsModule],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: PHOTO_READ_REPOSITORY, useClass: PhotoReadRepository },
    { provide: PHOTO_WRITE_REPOSITORY, useClass: PhotoWriteRepository },
  ],
  exports: [PHOTO_READ_REPOSITORY, PHOTO_WRITE_REPOSITORY],
})
export class PhotosModule {}
