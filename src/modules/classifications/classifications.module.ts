import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { PhotosModule } from '@photos/photos.module'
import { ProcessPhotoClassificationHandler } from './application/commands/process-photo-classification/process-photo-classification.handler'
import { PHOTO_CLASSIFICATION_WRITE_REPOSITORY } from './domain/ports'
import { PhotoClassificationWriteRepository } from './infrastructure/repositories/photo-classification-write.repository'

@Module({
  imports: [CqrsModule, forwardRef(() => PhotosModule)],
  controllers: [],
  providers: [
    ProcessPhotoClassificationHandler,
    {
      provide: PHOTO_CLASSIFICATION_WRITE_REPOSITORY,
      useClass: PhotoClassificationWriteRepository,
    },
  ],
  exports: [PHOTO_CLASSIFICATION_WRITE_REPOSITORY],
})
export class ClassificationsModule {}
