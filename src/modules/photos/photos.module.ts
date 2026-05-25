import { BullModule } from '@nestjs/bullmq'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { OrdersModule } from '@orders/orders.module'
import { AddPhotoBibHandler } from '@photos/application/commands/add-photo-bib/add-photo-bib.handler'
import { AddPhotoColorHandler } from '@photos/application/commands/add-photo-color/add-photo-color.handler'
import { ApplyBibCorrectionHandler } from '@photos/application/commands/apply-bib-correction/apply-bib-correction.handler'
import { ApplyColorCorrectionHandler } from '@photos/application/commands/apply-color-correction/apply-color-correction.handler'
import { BulkAssignCategoryHandler } from '@photos/application/commands/bulk-assign-category/bulk-assign-category.handler'
import { ConfirmPhotoBatchHandler } from '@photos/application/commands/confirm-photo-batch/confirm-photo-batch.handler'
import { ConfirmRetouchedUploadHandler } from '@photos/application/commands/confirm-retouched-upload/confirm-retouched-upload.handler'
import { DeletePhotoBibHandler } from '@photos/application/commands/delete-photo-bib/delete-photo-bib.handler'
import { DeletePhotoColorHandler } from '@photos/application/commands/delete-photo-color/delete-photo-color.handler'
import { GeneratePresignedUrlHandler } from '@photos/application/commands/generate-presigned-url/generate-presigned-url.handler'
import { GenerateRetouchedPresignedUrlHandler } from '@photos/application/commands/generate-retouched-presigned-url/generate-retouched-presigned-url.handler'
import { MarkPhotoReviewedHandler } from '@photos/application/commands/mark-photo-reviewed/mark-photo-reviewed.handler'
import { SetPhotoRetouchFlagHandler } from '@photos/application/commands/set-photo-retouch-flag/set-photo-retouch-flag.handler'
import { FindSimilarPhotosHandler } from '@photos/application/queries/find-similar-photos/find-similar-photos.handler'
import { GetDownloadManifestHandler } from '@photos/application/queries/get-download-manifest/get-download-manifest.handler'
import { GetPendingRetouchHandler } from '@photos/application/queries/get-pending-retouch/get-pending-retouch.handler'
import { GetPhotoDetailHandler } from '@photos/application/queries/get-photo-detail/get-photo-detail.handler'
import { GetPhotoDetailBySlugHandler } from '@photos/application/queries/get-photo-detail-by-slug/get-photo-detail-by-slug.handler'
import { GetPhotoDownloadUrlHandler } from '@photos/application/queries/get-photo-download-url/get-photo-download-url.handler'
import { GetPhotoViewHandler } from '@photos/application/queries/get-photo-view/get-photo-view.handler'
import { GetPhotosListHandler } from '@photos/application/queries/get-photos-list/get-photos-list.handler'
import { GetResumePointHandler } from '@photos/application/queries/get-resume-point/get-resume-point.handler'
import { GetReviewQueueHandler } from '@photos/application/queries/get-review-queue/get-review-queue.handler'
import { SearchPhotosHandler } from '@photos/application/queries/search-photos/search-photos.handler'
import {
  CORRECTION_REPOSITORY,
  PHOTO_BIB_WRITE_REPOSITORY,
  PHOTO_COLOR_WRITE_REPOSITORY,
  PHOTO_READ_REPOSITORY,
  PHOTO_WRITE_REPOSITORY,
} from '@photos/domain/ports'
import { EmbeddingGenerationProcessor } from '@photos/infrastructure/processors/embedding-generation.processor'
import { PhotoClassificationProcessor } from '@photos/infrastructure/processors/photo-classification.processor'
import { CorrectionRepository } from '@photos/infrastructure/repositories/correction.repository'
import { PhotoBibWriteRepository } from '@photos/infrastructure/repositories/photo-bib-write.repository'
import { PhotoColorWriteRepository } from '@photos/infrastructure/repositories/photo-color-write.repository'
import { PhotoReadRepository } from '@photos/infrastructure/repositories/photo-read.repository'
import { PhotoWriteRepository } from '@photos/infrastructure/repositories/photo-write.repository'
import { PhotosController } from '@photos/presentation/controllers/photos.controller'
import { ClassificationsModule } from '../classifications/classifications.module'
import { EventsModule } from '../events/events.module'

const CommandHandlers = [
  AddPhotoBibHandler,
  AddPhotoColorHandler,
  ApplyBibCorrectionHandler,
  ApplyColorCorrectionHandler,
  BulkAssignCategoryHandler,
  ConfirmPhotoBatchHandler,
  ConfirmRetouchedUploadHandler,
  DeletePhotoBibHandler,
  DeletePhotoColorHandler,
  GeneratePresignedUrlHandler,
  GenerateRetouchedPresignedUrlHandler,
  MarkPhotoReviewedHandler,
  SetPhotoRetouchFlagHandler,
]
const QueryHandlers = [
  FindSimilarPhotosHandler,
  GetPhotosListHandler,
  GetPhotoDetailHandler,
  GetPhotoDetailBySlugHandler,
  GetPhotoDownloadUrlHandler,
  GetPhotoViewHandler,
  GetResumePointHandler,
  GetReviewQueueHandler,
  GetDownloadManifestHandler,
  SearchPhotosHandler,
  GetPendingRetouchHandler,
]

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue({ name: 'embedding-generation' }, { name: 'photo-classification' }),
    forwardRef(() => EventsModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => ClassificationsModule),
  ],
  controllers: [PhotosController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    EmbeddingGenerationProcessor,
    PhotoClassificationProcessor,
    { provide: PHOTO_READ_REPOSITORY, useClass: PhotoReadRepository },
    { provide: PHOTO_WRITE_REPOSITORY, useClass: PhotoWriteRepository },
    { provide: CORRECTION_REPOSITORY, useClass: CorrectionRepository },
    { provide: PHOTO_BIB_WRITE_REPOSITORY, useClass: PhotoBibWriteRepository },
    { provide: PHOTO_COLOR_WRITE_REPOSITORY, useClass: PhotoColorWriteRepository },
  ],
  exports: [
    PHOTO_READ_REPOSITORY,
    PHOTO_WRITE_REPOSITORY,
    CORRECTION_REPOSITORY,
    PHOTO_BIB_WRITE_REPOSITORY,
    PHOTO_COLOR_WRITE_REPOSITORY,
  ],
})
export class PhotosModule {}
