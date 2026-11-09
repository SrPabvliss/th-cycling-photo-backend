import {
  ArchiveEventCommand,
  AssignOperatorCommand,
  AssignOperatorDto,
  CreateEventCommand,
  CreateEventDto,
  DeleteEventCommand,
  RestoreEventCommand,
  SetEventFreezeCommand,
  toConfigurationSelection,
  UnassignOperatorCommand,
  UpdateEventCommand,
  UpdateEventConfigurationCommand,
  UpdateEventConfigurationDto,
  UpdateEventDto,
  UpdateEventPhotoQuotaCommand,
} from '@events/application/commands'
import {
  EventConfigurationPresetProjection,
  EventConfigurationProjection,
  EventCreatedProjection,
  EventCreationContextProjection,
  EventDetailProjection,
  EventListProjection,
  EventsStatsProjection,
} from '@events/application/projections'
import {
  GetEventConfigurationPresetQuery,
  GetEventConfigurationQuery,
  GetEventCreationContextQuery,
  GetEventDetailQuery,
  GetEventOperatorsQuery,
  GetEventsListDto,
  GetEventsListQuery,
  GetEventsStatsQuery,
} from '@events/application/queries'
import type { EventListFilters } from '@events/application/queries/get-events-list/get-events-list.dto'
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { AuditContext, EntityIdProjection, Pagination } from '@shared/application'
import { CurrentUser, type ICurrentUser } from '@shared/auth'
import {
  AllowedWhenFrozen,
  BlocksWhenFrozen,
} from '@shared/authorization/presentation/decorators/freeze-policy.decorator'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import { SetEventFreezeDto } from '../dtos/set-event-freeze.dto'
import { UpdateEventPhotoQuotaDto } from '../dtos/update-event-photo-quota.dto'

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @RequirePermission('event.read')
  @AllowedWhenFrozen()
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List events with pagination' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated event list',
    type: EventListProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetEventsListDto, @CurrentUser() user: ICurrentUser) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetEventsListQuery(pagination, toEventListFilters(dto), user.userId)
    return this.queryBus.execute(query)
  }

  @RequirePermission('event.stats.read')
  @AllowedWhenFrozen()
  @Get('stats')
  @SuccessMessage('success.FETCHED', { entity: 'entities.stats' })
  @ApiOperation({ summary: 'Get global event and photo statistics' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Global statistics retrieved',
    type: EventsStatsProjection,
  })
  async getStats(@Query() dto: GetEventsListDto, @CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetEventsStatsQuery(toEventListFilters(dto), user.userId))
  }

  @RequirePermission('event.create')
  @AllowedWhenFrozen()
  @Get('configuration/preset')
  @SuccessMessage('success.FETCHED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Get the tenant configuration preset for a new event' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Configuration preset retrieved',
    type: EventConfigurationPresetProjection,
  })
  async getConfigurationPreset(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetEventConfigurationPresetQuery(user.userId))
  }

  @RequirePermission('event.create')
  @AllowedWhenFrozen()
  @Get('creation-context')
  @SuccessMessage('success.FETCHED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Get the contract and quota context for creating a new event' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event creation context retrieved',
    type: EventCreationContextProjection,
  })
  async getCreationContext(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetEventCreationContextQuery(user.userId))
  }

  @RequirePermission('event.read')
  @AllowedWhenFrozen()
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
  async findOne(@Param('slug') slug: string, @CurrentUser() user: ICurrentUser) {
    const query = new GetEventDetailQuery(slug, user.userId)
    return this.queryBus.execute(query)
  }

  @RequirePermission('event.create')
  @AllowedWhenFrozen()
  @Post()
  @SuccessMessage('success.CREATED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Create a new event' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Event created successfully',
    type: EventCreatedProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  async create(@Body() dto: CreateEventDto, @CurrentUser() user: ICurrentUser) {
    const command = new CreateEventCommand(
      dto.name,
      dto.startDate,
      dto.endDate,
      dto.provinceId ?? null,
      dto.cantonId ?? null,
      dto.eventTypeId,
      new AuditContext(user.userId),
      dto.configuration ? toConfigurationSelection(dto.configuration) : undefined,
    )
    return this.commandBus.execute(command)
  }

  @RequirePermission('event.update')
  @BlocksWhenFrozen()
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
      dto.startDate,
      dto.endDate,
      dto.provinceId,
      dto.cantonId,
      dto.eventTypeId,
      new AuditContext(user.userId),
    )
    return this.commandBus.execute(command)
  }

  @RequirePermission('event.read')
  @AllowedWhenFrozen()
  @Get(':id/configuration')
  @SuccessMessage('success.FETCHED', { entity: 'entities.event' })
  @ApiOperation({ summary: "Get an event's configuration" })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event configuration retrieved',
    type: EventConfigurationProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async getConfiguration(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetEventConfigurationQuery(id, user.userId))
  }

  @RequirePermission('event.update')
  @BlocksWhenFrozen()
  @Patch(':id/configuration')
  @SuccessMessage('success.UPDATED', { entity: 'entities.event' })
  @ApiOperation({ summary: "Update an event's configuration" })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event configuration updated successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Event is frozen and not configurable' })
  async updateConfiguration(
    @Param('id') id: string,
    @Body() dto: UpdateEventConfigurationDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const command = new UpdateEventConfigurationCommand(
      id,
      user.userId,
      toConfigurationSelection(dto),
    )
    return this.commandBus.execute(command)
  }

  @RequirePermission('event.archive')
  @BlocksWhenFrozen()
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
  async archive(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const command = new ArchiveEventCommand(id, user.userId)
    return this.commandBus.execute(command)
  }

  @RequirePermission('event.freeze')
  // Allowed while frozen, otherwise freezing would be a one-way door and unfreeze could never run.
  @AllowedWhenFrozen()
  @Patch(':id/freeze')
  @SuccessMessage('success.UPDATED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Congelar o descongelar un evento' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event freeze state updated successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async setFreeze(
    @Param('id') id: string,
    @Body() dto: SetEventFreezeDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.commandBus.execute(new SetEventFreezeCommand(id, dto.frozen, user.userId))
  }

  @RequirePermission('event.photo_quota.set')
  @BlocksWhenFrozen()
  @Patch(':id/photo-quota')
  @SuccessMessage('success.UPDATED', { entity: 'entities.event' })
  @ApiOperation({ summary: "Override an event's photo quota" })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async updatePhotoQuota(
    @Param('id') id: string,
    @Body() dto: UpdateEventPhotoQuotaDto,
  ): Promise<void> {
    await this.commandBus.execute(new UpdateEventPhotoQuotaCommand(id, dto.quota))
  }

  @RequirePermission('event.restore')
  @BlocksWhenFrozen()
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
  async restore(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const command = new RestoreEventCommand(id, user.userId)
    return this.commandBus.execute(command)
  }

  @RequirePermission('event.delete')
  @BlocksWhenFrozen()
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
  async remove(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const command = new DeleteEventCommand(id, user.userId)
    return this.commandBus.execute(command)
  }

  // ─── Event Operator Assignment ──────────────────────────────────────────────

  @RequirePermission('event.collaborator.read')
  @AllowedWhenFrozen()
  @Get(':id/operators')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List operators assigned to an event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  async getOperators(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetEventOperatorsQuery(id, user.userId))
  }

  @RequirePermission('event.collaborator.assign')
  @BlocksWhenFrozen()
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

  @RequirePermission('event.collaborator.unassign')
  @BlocksWhenFrozen()
  @Delete(':id/operators/:userId')
  @HttpCode(200)
  @SuccessMessage('success.DELETED', { entity: 'entities.event_operator' })
  @ApiOperation({ summary: 'Unassign an operator from an event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiParam({ name: 'userId', description: 'Operator user UUID', format: 'uuid' })
  async unassignOperator(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const command = new UnassignOperatorCommand(id, userId, user.userId)
    await this.commandBus.execute(command)
  }
}

function toEventListFilters(dto: GetEventsListDto): EventListFilters {
  return {
    search: dto.search,
    tab: dto.tab,
    organizerId: dto.organizerId,
    sort: dto.sort,
  }
}
