import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { UploadPhotosHandler } from '@photos/application/commands/upload-photos/upload-photos.handler'
import { PHOTO_READ_REPOSITORY, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import { PhotoReadRepository } from '@photos/infrastructure/repositories/photo-read.repository'
import { PhotoWriteRepository } from '@photos/infrastructure/repositories/photo-write.repository'
import { EventsModule } from '../events/events.module'

const CommandHandlers = [UploadPhotosHandler]

@Module({
  imports: [CqrsModule, EventsModule],
  providers: [
    ...CommandHandlers,
    { provide: PHOTO_READ_REPOSITORY, useClass: PhotoReadRepository },
    { provide: PHOTO_WRITE_REPOSITORY, useClass: PhotoWriteRepository },
  ],
  exports: [PHOTO_READ_REPOSITORY, PHOTO_WRITE_REPOSITORY],
})
export class PhotosModule {}
