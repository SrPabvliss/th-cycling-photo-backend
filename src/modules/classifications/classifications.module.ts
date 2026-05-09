import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { PhotosModule } from '@photos/photos.module'
import { ProcessPhotoClassificationHandler } from './application/commands/process-photo-classification/process-photo-classification.handler'
import { CROP_UPLOAD_URLS_SERVICE, PHOTO_CLASSIFICATION_WRITE_REPOSITORY } from './domain/ports'
import { PhotoClassificationWriteRepository } from './infrastructure/repositories/photo-classification-write.repository'
import { CropUploadUrlsService } from './infrastructure/services/crop-upload-urls.service'

@Module({
  imports: [CqrsModule, forwardRef(() => PhotosModule)],
  controllers: [],
  providers: [
    ProcessPhotoClassificationHandler,
    {
      provide: PHOTO_CLASSIFICATION_WRITE_REPOSITORY,
      useClass: PhotoClassificationWriteRepository,
    },
    {
      provide: CROP_UPLOAD_URLS_SERVICE,
      useClass: CropUploadUrlsService,
    },
  ],
  exports: [PHOTO_CLASSIFICATION_WRITE_REPOSITORY, CROP_UPLOAD_URLS_SERVICE],
})
export class ClassificationsModule {}
