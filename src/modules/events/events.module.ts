import { ArchiveEventHandler } from '@events/application/commands/archive-event/archive-event.handler'
import { AssignOperatorHandler } from '@events/application/commands/assign-operator/assign-operator.handler'
import { CreateEventHandler } from '@events/application/commands/create-event/create-event.handler'
import { DeleteEventHandler } from '@events/application/commands/delete-event/delete-event.handler'
import { RestoreEventHandler } from '@events/application/commands/restore-event/restore-event.handler'
import { SetFeaturedEventHandler } from '@events/application/commands/set-featured-event/set-featured-event.handler'
import { UnassignOperatorHandler } from '@events/application/commands/unassign-operator/unassign-operator.handler'
import { UpdateEventHandler } from '@events/application/commands/update-event/update-event.handler'
import { GetEventDetailHandler } from '@events/application/queries/get-event-detail/get-event-detail.handler'
import { GetEventOperatorsHandler } from '@events/application/queries/get-event-operators/get-event-operators.handler'
import { GetEventsListHandler } from '@events/application/queries/get-events-list/get-events-list.handler'
import { GetEventsStatsHandler } from '@events/application/queries/get-events-stats/get-events-stats.handler'
import { GetPublicEventDetailHandler } from '@events/application/queries/get-public-event-detail/get-public-event-detail.handler'
import { GetPublicEventPhotosHandler } from '@events/application/queries/get-public-event-photos/get-public-event-photos.handler'
import { GetPublicEventsListHandler } from '@events/application/queries/get-public-events-list/get-public-events-list.handler'
import {
  EVENT_OPERATOR_REPOSITORY,
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
} from '@events/domain/ports'
import { EventOperatorRepository } from '@events/infrastructure/repositories/event-operator.repository'
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
  AssignOperatorHandler,
  CreateEventHandler,
  DeleteEventHandler,
  RestoreEventHandler,
  SetFeaturedEventHandler,
  UnassignOperatorHandler,
  UpdateEventHandler,
]
const QueryHandlers = [
  GetEventsListHandler,
  GetEventDetailHandler,
  GetEventOperatorsHandler,
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
    { provide: EVENT_OPERATOR_REPOSITORY, useClass: EventOperatorRepository },
  ],
  exports: [EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY, EVENT_OPERATOR_REPOSITORY],
})
export class EventsModule {}
