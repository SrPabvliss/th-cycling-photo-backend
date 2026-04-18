import { EventsModule } from '@events/events.module'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { ConfirmAssetUploadHandler } from './application/commands/confirm-asset-upload/confirm-asset-upload.handler'
import { DeleteEventAssetHandler } from './application/commands/delete-event-asset/delete-event-asset.handler'
import { GenerateAssetPresignedUrlHandler } from './application/commands/generate-asset-presigned-url/generate-asset-presigned-url.handler'
import { GetEventAssetsHandler } from './application/queries/get-event-assets/get-event-assets.handler'
import { EVENT_ASSET_READ_REPOSITORY, EVENT_ASSET_WRITE_REPOSITORY } from './domain/ports'
import { EventAssetReadRepository } from './infrastructure/repositories/event-asset-read.repository'
import { EventAssetWriteRepository } from './infrastructure/repositories/event-asset-write.repository'
import { EventAssetsController } from './presentation/controllers/event-assets.controller'

const CommandHandlers = [
  GenerateAssetPresignedUrlHandler,
  ConfirmAssetUploadHandler,
  DeleteEventAssetHandler,
]
const QueryHandlers = [GetEventAssetsHandler]

@Module({
  imports: [CqrsModule, EventsModule],
  controllers: [EventAssetsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: EVENT_ASSET_READ_REPOSITORY, useClass: EventAssetReadRepository },
    { provide: EVENT_ASSET_WRITE_REPOSITORY, useClass: EventAssetWriteRepository },
  ],
  exports: [EVENT_ASSET_READ_REPOSITORY],
})
export class EventAssetsModule {}
