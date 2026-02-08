import { CreateEventHandler } from '@events/application/commands/create-event/create-event.handler'
import { GetEventDetailHandler } from '@events/application/queries/get-event-detail/get-event-detail.handler'
import { GetEventsListHandler } from '@events/application/queries/get-events-list/get-events-list.handler'
import { EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY } from '@events/domain/ports'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { EventWriteRepository } from '@events/infrastructure/repositories/event-write.repository'
import { EventsController } from '@events/presentation/controllers/events.controller'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { DeleteEventHandler } from './application/commands/delete-event/delete-event.handler'
import { UpdateEventHandler } from './application/commands/update-event/update-event.handler'

const CommandHandlers = [CreateEventHandler, UpdateEventHandler, DeleteEventHandler]
const QueryHandlers = [GetEventsListHandler, GetEventDetailHandler]

@Module({
  imports: [CqrsModule],
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
