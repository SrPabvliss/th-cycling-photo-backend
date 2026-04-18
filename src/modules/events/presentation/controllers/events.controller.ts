import {
  ArchiveEventCommand,
  AssignOperatorCommand,
  AssignOperatorDto,
  CreateEventCommand,
  CreateEventDto,
  DeleteEventCommand,
  RestoreEventCommand,
  SetFeaturedEventCommand,
  SetFeaturedEventDto,
  UnassignOperatorCommand,
  UpdateEventCommand,
  UpdateEventDto,
} from '@events/application/commands'
import {
  EventDetailProjection,
  EventListProjection,
  EventsStatsProjection,
} from '@events/application/projections'
import {
  GetEventDetailQuery,
  GetEventOperatorsQuery,
  GetEventsListDto,
  GetEventsListQuery,
  GetEventsStatsQuery,
} from '@events/application/queries'
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { AuditContext, EntityIdProjection, Pagination } from '@shared/application'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Events')
@ApiBearerAuth()
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
    const query = new GetEventsListQuery(pagination, dto.includeArchived ?? false, dto.search)
    return this.queryBus.execute(query)
  }

  @Get('stats')
  @SuccessMessage('success.FETCHED', { entity: 'entities.stats' })
  @ApiOperation({ summary: 'Get global event and photo statistics' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Global statistics retrieved',
    type: EventsStatsProjection,
  })
  async getStats() {
    return this.queryBus.execute(new GetEventsStatsQuery())
  }

  @Get(':slug')
  @SuccessMessage('success.FETCHED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Get event details by slug' })
  @ApiParam({ name: 'slug', description: 'Event URL slug', example: 'vuelta-al-cotopaxi-2026' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event detail retrieved',
    type: EventDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('slug') slug: string) {
    const query = new GetEventDetailQuery(slug)
    return this.queryBus.execute(query)
  }

  @Roles('admin')
  @Post()
  @SuccessMessage('success.CREATED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Create a new event' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Event created successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  async create(@Body() dto: CreateEventDto, @CurrentUser() user: ICurrentUser) {
    const command = new CreateEventCommand(
      dto.name,
      dto.date,
      dto.description ?? null,
      dto.provinceId ?? null,
      dto.cantonId ?? null,
      dto.eventTypeId,
      new AuditContext(user.userId),
    )
    return this.commandBus.execute(command)
  }

  @Roles('admin')
  @Patch(':id')
  @SuccessMessage('success.UPDATED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Update an existing event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event updated successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const command = new UpdateEventCommand(
      id,
      dto.name,
      dto.date,
      dto.description,
      dto.provinceId,
      dto.cantonId,
      dto.eventTypeId,
      new AuditContext(user.userId),
    )
    return this.commandBus.execute(command)
  }

  @Roles('admin')
  @Patch(':id/featured')
  @SuccessMessage('success.UPDATED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Toggle featured status for an event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Featured status updated',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async setFeatured(@Param('id') id: string, @Body() dto: SetFeaturedEventDto) {
    const command = new SetFeaturedEventCommand(id, dto.isFeatured)
    return this.commandBus.execute(command)
  }

  @Roles('admin')
  @Patch(':id/archive')
  @SuccessMessage('success.UPDATED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Archive an event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event archived successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Event is already archived' })
  async archive(@Param('id') id: string) {
    const command = new ArchiveEventCommand(id)
    return this.commandBus.execute(command)
  }

  @Roles('admin')
  @Patch(':id/restore')
  @SuccessMessage('success.UPDATED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Restore an archived event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event restored successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Event is not archived' })
  async restore(@Param('id') id: string) {
    const command = new RestoreEventCommand(id)
    return this.commandBus.execute(command)
  }

  @Roles('admin')
  @Delete(':id')
  @SuccessMessage('success.DELETED', { entity: 'entities.event' })
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

  // ─── Event Operator Assignment ──────────────────────────────────────────────

  @Roles('admin')
  @Get(':id/operators')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List operators assigned to an event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  async getOperators(@Param('id') id: string) {
    return this.queryBus.execute(new GetEventOperatorsQuery(id))
  }

  @Roles('admin')
  @Post(':id/operators')
  @SuccessMessage('success.CREATED', { entity: 'entities.event_operator' })
  @ApiOperation({ summary: 'Assign an operator to an event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  async assignOperator(
    @Param('id') id: string,
    @Body() dto: AssignOperatorDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const command = new AssignOperatorCommand(id, dto.userId, user.userId)
    await this.commandBus.execute(command)
  }

  @Roles('admin')
  @Delete(':id/operators/:userId')
  @HttpCode(200)
  @SuccessMessage('success.DELETED', { entity: 'entities.event_operator' })
  @ApiOperation({ summary: 'Unassign an operator from an event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiParam({ name: 'userId', description: 'Operator user UUID', format: 'uuid' })
  async unassignOperator(@Param('id') id: string, @Param('userId') userId: string) {
    const command = new UnassignOperatorCommand(id, userId)
    await this.commandBus.execute(command)
  }
}
