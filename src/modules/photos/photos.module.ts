import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { ConfirmPhotoBatchHandler } from '@photos/application/commands/confirm-photo-batch/confirm-photo-batch.handler'
import { ConfirmRetouchedUploadHandler } from '@photos/application/commands/confirm-retouched-upload/confirm-retouched-upload.handler'
import { GeneratePresignedUrlHandler } from '@photos/application/commands/generate-presigned-url/generate-presigned-url.handler'
import { GenerateRetouchedPresignedUrlHandler } from '@photos/application/commands/generate-retouched-presigned-url/generate-retouched-presigned-url.handler'
import { GetDownloadManifestHandler } from '@photos/application/queries/get-download-manifest/get-download-manifest.handler'
import { GetPhotoDetailHandler } from '@photos/application/queries/get-photo-detail/get-photo-detail.handler'
import { GetPhotoDownloadUrlHandler } from '@photos/application/queries/get-photo-download-url/get-photo-download-url.handler'
import { GetPhotosListHandler } from '@photos/application/queries/get-photos-list/get-photos-list.handler'
import { GetResumePointHandler } from '@photos/application/queries/get-resume-point/get-resume-point.handler'
import { SearchPhotosHandler } from '@photos/application/queries/search-photos/search-photos.handler'
import { PHOTO_READ_REPOSITORY, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import { PhotoReadRepository } from '@photos/infrastructure/repositories/photo-read.repository'
import { PhotoWriteRepository } from '@photos/infrastructure/repositories/photo-write.repository'
import { PhotosController } from '@photos/presentation/controllers/photos.controller'
import { EventsModule } from '../events/events.module'

const CommandHandlers = [
  ConfirmPhotoBatchHandler,
  ConfirmRetouchedUploadHandler,
  GeneratePresignedUrlHandler,
  GenerateRetouchedPresignedUrlHandler,
]
const QueryHandlers = [
  GetPhotosListHandler,
  GetPhotoDetailHandler,
  GetPhotoDownloadUrlHandler,
  GetResumePointHandler,
  GetDownloadManifestHandler,
  SearchPhotosHandler,
]

@Module({
  imports: [CqrsModule, forwardRef(() => EventsModule)],
  controllers: [PhotosController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: PHOTO_READ_REPOSITORY, useClass: PhotoReadRepository },
    { provide: PHOTO_WRITE_REPOSITORY, useClass: PhotoWriteRepository },
  ],
  exports: [PHOTO_READ_REPOSITORY, PHOTO_WRITE_REPOSITORY],
})
export class PhotosModule {}
