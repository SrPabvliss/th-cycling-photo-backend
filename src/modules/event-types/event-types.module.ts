import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { GetAllEventTypesHandler } from './application/queries/get-all-event-types/get-all-event-types.handler'
import { EVENT_TYPE_READ_REPOSITORY } from './domain/ports'
import { EventTypeReadRepository } from './infrastructure/repositories/event-type-read.repository'
import { EventTypesController } from './presentation/controllers/event-types.controller'

const QueryHandlers = [GetAllEventTypesHandler]

@Module({
  imports: [CqrsModule],
  controllers: [EventTypesController],
  providers: [
    ...QueryHandlers,
    { provide: EVENT_TYPE_READ_REPOSITORY, useClass: EventTypeReadRepository },
  ],
  exports: [EVENT_TYPE_READ_REPOSITORY],
})
export class EventTypesModule {}
