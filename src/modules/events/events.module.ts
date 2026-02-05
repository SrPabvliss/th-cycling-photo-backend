import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { CreateEventHandler } from './application/commands/create-event/create-event.handler.js'
import { DeleteEventHandler } from './application/commands/delete-event/delete-event.handler.js'
import { UpdateEventHandler } from './application/commands/update-event/update-event.handler.js'
import { GetEventDetailHandler } from './application/queries/get-event-detail/get-event-detail.handler.js'
import { GetEventsListHandler } from './application/queries/get-events-list/get-events-list.handler.js'
import { EVENT_READ_REPOSITORY } from './domain/ports/event-read-repository.port.js'
import { EVENT_WRITE_REPOSITORY } from './domain/ports/event-write-repository.port.js'
import { EventReadRepository } from './infrastructure/repositories/event-read.repository.js'
import { EventWriteRepository } from './infrastructure/repositories/event-write.repository.js'
import { EventsController } from './presentation/controllers/events.controller.js'

const CommandHandlers = [CreateEventHandler, DeleteEventHandler, UpdateEventHandler]
const QueryHandlers = [GetEventDetailHandler, GetEventsListHandler]

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
