import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { CreateEventHandler } from './application/commands/create-event/create-event.handler.js'
import { GetEventsListHandler } from './application/queries/get-events-list/get-events-list.handler.js'
import { EventReadRepository } from './infrastructure/repositories/event-read.repository.js'
import { EventWriteRepository } from './infrastructure/repositories/event-write.repository.js'
import { EventsController } from './presentation/controllers/events.controller.js'

const CommandHandlers = [CreateEventHandler]
const QueryHandlers = [GetEventsListHandler]
const Repositories = [EventWriteRepository, EventReadRepository]

@Module({
  imports: [CqrsModule],
  controllers: [EventsController],
  providers: [...CommandHandlers, ...QueryHandlers, ...Repositories],
  exports: [...Repositories],
})
export class EventsModule {}
