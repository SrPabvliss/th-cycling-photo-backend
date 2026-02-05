import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import type { CommandBus, QueryBus } from '@nestjs/cqrs'
import { Pagination } from '../../../../shared/application/pagination.js'
import { SuccessMessage } from '../../../../shared/http/decorators/success-message.decorator.js'
import { CreateEventCommand } from '../../application/commands/create-event/create-event.command.js'
import type { CreateEventDto } from '../../application/commands/create-event/create-event.dto.js'
import { DeleteEventCommand } from '../../application/commands/delete-event/delete-event.command.js'
import { UpdateEventCommand } from '../../application/commands/update-event/update-event.command.js'
import type { UpdateEventDto } from '../../application/commands/update-event/update-event.dto.js'
import { GetEventDetailQuery } from '../../application/queries/get-event-detail/get-event-detail.query.js'
import type { GetEventsListDto } from '../../application/queries/get-events-list/get-events-list.dto.js'
import { GetEventsListQuery } from '../../application/queries/get-events-list/get-events-list.query.js'

@Controller('events')
export class EventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @SuccessMessage('success.CREATED')
  async create(@Body() dto: CreateEventDto) {
    const command = new CreateEventCommand(dto.name, dto.date, dto.location ?? null)
    return this.commandBus.execute(command)
  }

  @Patch(':id')
  @SuccessMessage('success.UPDATED')
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    const command = new UpdateEventCommand(id, dto.name, dto.date, dto.location)
    return this.commandBus.execute(command)
  }

  @Delete(':id')
  @SuccessMessage('success.DELETED')
  async remove(@Param('id') id: string) {
    const command = new DeleteEventCommand(id)
    return this.commandBus.execute(command)
  }

  @Get(':id')
  @SuccessMessage('success.FETCHED')
  async findOne(@Param('id') id: string) {
    const query = new GetEventDetailQuery(id)
    return this.queryBus.execute(query)
  }

  @Get()
  @SuccessMessage('success.LIST')
  async findAll(@Query() dto: GetEventsListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetEventsListQuery(pagination)
    return this.queryBus.execute(query)
  }
}
