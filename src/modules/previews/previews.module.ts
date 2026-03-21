import { EventsModule } from '@events/events.module'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { CreatePreviewLinkHandler } from '@previews/application/commands/create-preview-link/create-preview-link.handler'
import { GetPreviewByTokenHandler } from '@previews/application/queries/get-preview-by-token/get-preview-by-token.handler'
import { GetPreviewLinksListHandler } from '@previews/application/queries/get-preview-links-list/get-preview-links-list.handler'
import { WatermarkUrlService } from '@previews/application/services/watermark-url.service'
import { PREVIEW_LINK_READ_REPOSITORY, PREVIEW_LINK_WRITE_REPOSITORY } from '@previews/domain/ports'
import { PreviewLinkReadRepository } from '@previews/infrastructure/repositories/preview-link-read.repository'
import { PreviewLinkWriteRepository } from '@previews/infrastructure/repositories/preview-link-write.repository'
import { PreviewLinksController } from '@previews/presentation/controllers/preview-links.controller'
import { PreviewPublicController } from '@previews/presentation/controllers/preview-public.controller'
import { PhotosModule } from '../photos/photos.module'

const CommandHandlers = [CreatePreviewLinkHandler]
const QueryHandlers = [GetPreviewByTokenHandler, GetPreviewLinksListHandler]

@Module({
  imports: [CqrsModule, EventsModule, PhotosModule],
  controllers: [PreviewLinksController, PreviewPublicController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    WatermarkUrlService,
    { provide: PREVIEW_LINK_READ_REPOSITORY, useClass: PreviewLinkReadRepository },
    { provide: PREVIEW_LINK_WRITE_REPOSITORY, useClass: PreviewLinkWriteRepository },
  ],
  exports: [PREVIEW_LINK_READ_REPOSITORY, PREVIEW_LINK_WRITE_REPOSITORY],
})
export class PreviewsModule {}
