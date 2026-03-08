import { ArchiveEventHandler } from '@events/application/commands/archive-event/archive-event.handler'
import { CreateEventHandler } from '@events/application/commands/create-event/create-event.handler'
import { RestoreEventHandler } from '@events/application/commands/restore-event/restore-event.handler'
import { GetEventDetailHandler } from '@events/application/queries/get-event-detail/get-event-detail.handler'
import { GetEventsListHandler } from '@events/application/queries/get-events-list/get-events-list.handler'
import { EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY } from '@events/domain/ports'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { EventWriteRepository } from '@events/infrastructure/repositories/event-write.repository'
import { EventsController } from '@events/presentation/controllers/events.controller'
import { LocationsModule } from '@locations/locations.module'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { PhotosModule } from '../photos/photos.module'
import { ConfirmEventCoverHandler } from './application/commands/confirm-event-cover/confirm-event-cover.handler'
import { DeleteEventHandler } from './application/commands/delete-event/delete-event.handler'
import { GenerateCoverUrlHandler } from './application/commands/generate-cover-url/generate-cover-url.handler'
import { RemoveEventCoverHandler } from './application/commands/remove-event-cover/remove-event-cover.handler'
import { UpdateEventHandler } from './application/commands/update-event/update-event.handler'

const CommandHandlers = [
  ArchiveEventHandler,
  CreateEventHandler,
  DeleteEventHandler,
  GenerateCoverUrlHandler,
  RemoveEventCoverHandler,
  RestoreEventHandler,
  ConfirmEventCoverHandler,
  UpdateEventHandler,
]
const QueryHandlers = [GetEventsListHandler, GetEventDetailHandler]

@Module({
  imports: [CqrsModule, LocationsModule, forwardRef(() => PhotosModule)],
  controllers: [EventsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: EVENT_READ_REPOSITORY, useClass: EventReadRepository },
    { provide: EVENT_WRITE_REPOSITORY, useClass: EventWriteRepository },
  ],
  exports: [EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY],
})
export class EventsModule {}
