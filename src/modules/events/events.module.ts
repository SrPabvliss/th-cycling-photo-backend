import { ArchiveEventHandler } from '@events/application/commands/archive-event/archive-event.handler'
import { CreateEventHandler } from '@events/application/commands/create-event/create-event.handler'
import { DeleteEventHandler } from '@events/application/commands/delete-event/delete-event.handler'
import { RestoreEventHandler } from '@events/application/commands/restore-event/restore-event.handler'
import { SetFeaturedEventHandler } from '@events/application/commands/set-featured-event/set-featured-event.handler'
import { UpdateEventHandler } from '@events/application/commands/update-event/update-event.handler'
import { GetEventDetailHandler } from '@events/application/queries/get-event-detail/get-event-detail.handler'
import { GetEventsListHandler } from '@events/application/queries/get-events-list/get-events-list.handler'
import { GetEventsStatsHandler } from '@events/application/queries/get-events-stats/get-events-stats.handler'
import { GetPublicEventDetailHandler } from '@events/application/queries/get-public-event-detail/get-public-event-detail.handler'
import { GetPublicEventPhotosHandler } from '@events/application/queries/get-public-event-photos/get-public-event-photos.handler'
import { GetPublicEventsListHandler } from '@events/application/queries/get-public-events-list/get-public-events-list.handler'
import { EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY } from '@events/domain/ports'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { EventWriteRepository } from '@events/infrastructure/repositories/event-write.repository'
import { EventsController } from '@events/presentation/controllers/events.controller'
import { PublicEventsController } from '@events/presentation/controllers/public-events.controller'
import { LocationsModule } from '@locations/locations.module'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { PhotosModule } from '../photos/photos.module'

const CommandHandlers = [
  ArchiveEventHandler,
  CreateEventHandler,
  DeleteEventHandler,
  RestoreEventHandler,
  SetFeaturedEventHandler,
  UpdateEventHandler,
]
const QueryHandlers = [
  GetEventsListHandler,
  GetEventDetailHandler,
  GetEventsStatsHandler,
  GetPublicEventsListHandler,
  GetPublicEventDetailHandler,
  GetPublicEventPhotosHandler,
]

@Module({
  imports: [CqrsModule, LocationsModule, forwardRef(() => PhotosModule)],
  controllers: [EventsController, PublicEventsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: EVENT_READ_REPOSITORY, useClass: EventReadRepository },
    { provide: EVENT_WRITE_REPOSITORY, useClass: EventWriteRepository },
  ],
  exports: [EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY],
})
export class EventsModule {}
