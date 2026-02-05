import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Pagination } from '../../../../shared/application/pagination.js'
import { EntityIdProjection } from '../../../../shared/application/projections/entity-id.projection.js'
import { SuccessMessage } from '../../../../shared/http/decorators/success-message.decorator.js'
import {
  ApiEnvelopeErrorResponse,
  ApiEnvelopeResponse,
} from '../../../../shared/http/swagger/api-envelope-response.decorator.js'
import { CreateEventCommand } from '../../application/commands/create-event/create-event.command.js'
import { CreateEventDto } from '../../application/commands/create-event/create-event.dto.js'
import { DeleteEventCommand } from '../../application/commands/delete-event/delete-event.command.js'
import { UpdateEventCommand } from '../../application/commands/update-event/update-event.command.js'
import { UpdateEventDto } from '../../application/commands/update-event/update-event.dto.js'
import { EventDetailProjection } from '../../application/projections/event-detail.projection.js'
import { EventListProjection } from '../../application/projections/event-list.projection.js'
import { GetEventDetailQuery } from '../../application/queries/get-event-detail/get-event-detail.query.js'
import { GetEventsListDto } from '../../application/queries/get-events-list/get-events-list.dto.js'
import { GetEventsListQuery } from '../../application/queries/get-events-list/get-events-list.query.js'

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List events with pagination' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated event list',
    type: EventListProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetEventsListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetEventsListQuery(pagination)
    return this.queryBus.execute(query)
  }

  @Get(':id')
  @SuccessMessage('success.FETCHED')
  @ApiOperation({ summary: 'Get event details by ID' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event detail retrieved',
    type: EventDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    const query = new GetEventDetailQuery(id)
    return this.queryBus.execute(query)
  }

  @Post()
  @SuccessMessage('success.CREATED')
  @ApiOperation({ summary: 'Create a new event' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Event created successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  async create(@Body() dto: CreateEventDto) {
    const command = new CreateEventCommand(dto.name, dto.date, dto.location ?? null)
    return this.commandBus.execute(command)
  }

  @Patch(':id')
  @SuccessMessage('success.UPDATED')
  @ApiOperation({ summary: 'Update an existing event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event updated successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    const command = new UpdateEventCommand(id, dto.name, dto.date, dto.location)
    return this.commandBus.execute(command)
  }

  @Delete(':id')
  @SuccessMessage('success.DELETED')
  @ApiOperation({ summary: 'Delete an event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event deleted successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async remove(@Param('id') id: string) {
    const command = new DeleteEventCommand(id)
    return this.commandBus.execute(command)
  }
}
