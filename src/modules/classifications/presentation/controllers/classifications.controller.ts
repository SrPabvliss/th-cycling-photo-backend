import {
  BulkClassifyCommand,
  BulkClassifyDto,
  CreateParticipantCommand,
  CreateParticipantDto,
  DeleteParticipantCommand,
  MarkPhotoClassifiedCommand,
  UpdateParticipantCommand,
  UpdateParticipantDto,
} from '@classifications/application/commands'
import {
  BulkClassifyResultProjection,
  ParticipantDetailProjection,
  ParticipantListProjection,
} from '@classifications/application/projections'
import {
  GetGearTypesQuery,
  GetParticipantCategoriesQuery,
  GetParticipantDetailQuery,
  GetPhotoParticipantsQuery,
} from '@classifications/application/queries'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import { AuditContext, EntityIdProjection } from '@shared/application'
import { CurrentUser, type ICurrentUser, Public } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Classifications')
@ApiBearerAuth()
@Controller()
export class ClassificationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** Lists gear types filtered by event type. */
  @Get('gear-types')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List gear types for an event type' })
  @ApiQuery({ name: 'eventTypeId', description: 'Event Type ID', type: Number, required: true })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Gear types retrieved',
    type: Object,
    isArray: true,
  })
  async getGearTypes(@Query('eventTypeId', ParseIntPipe) eventTypeId: number) {
    return this.queryBus.execute(new GetGearTypesQuery(eventTypeId))
  }

  /** Lists participant categories filtered by event type. */
  @Public()
  @Get('participant-categories')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List participant categories for an event type' })
  @ApiQuery({ name: 'eventTypeId', description: 'Event Type ID', type: Number, required: true })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Participant categories retrieved',
    type: Object,
    isArray: true,
  })
  async getParticipantCategories(@Query('eventTypeId', ParseIntPipe) eventTypeId: number) {
    return this.queryBus.execute(new GetParticipantCategoriesQuery(eventTypeId))
  }

  /** Lists all detected participants for a given photo. */
  @Get('photos/:photoId/participants')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List detected participants for a photo' })
  @ApiParam({ name: 'photoId', description: 'Photo UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Participants list for the photo',
    type: ParticipantListProjection,
    isArray: true,
  })
  async findAll(@Param('photoId') photoId: string) {
    return this.queryBus.execute(new GetPhotoParticipantsQuery(photoId))
  }

  /** Retrieves detailed information for a specific participant. */
  @Get('participants/:id')
  @SuccessMessage('success.FETCHED', { entity: 'entities.participant' })
  @ApiOperation({ summary: 'Get participant detail by ID' })
  @ApiParam({ name: 'id', description: 'Participant UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Participant detail retrieved',
    type: ParticipantDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Participant not found' })
  async findOne(@Param('id') id: string) {
    return this.queryBus.execute(new GetParticipantDetailQuery(id))
  }

  /** Creates a new participant classification for a photo. */
  @Post('photos/:photoId/participants')
  @SuccessMessage('success.CREATED', { entity: 'entities.participant' })
  @ApiOperation({ summary: 'Create a participant classification for a photo' })
  @ApiParam({ name: 'photoId', description: 'Photo UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Participant created',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async create(
    @Param('photoId') photoId: string,
    @Body() dto: CreateParticipantDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const command = new CreateParticipantCommand(
      photoId,
      dto.identifier ?? null,
      dto.colors,
      new AuditContext(user.userId),
    )
    return this.commandBus.execute(command)
  }

  /** Updates an existing participant classification. */
  @Patch('participants/:id')
  @SuccessMessage('success.UPDATED', { entity: 'entities.participant' })
  @ApiOperation({ summary: 'Update a participant classification' })
  @ApiParam({ name: 'id', description: 'Participant UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Participant updated',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Participant not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateParticipantDto) {
    const command = new UpdateParticipantCommand(id, dto.identifier, dto.colors)
    return this.commandBus.execute(command)
  }

  /** Deletes a participant classification. */
  @Delete('participants/:id')
  @SuccessMessage('success.DELETED', { entity: 'entities.participant' })
  @ApiOperation({ summary: 'Delete a participant classification' })
  @ApiParam({ name: 'id', description: 'Participant UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Participant deleted',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Participant not found' })
  async remove(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteParticipantCommand(id))
  }

  /** Marks a photo as classified. */
  @Post('photos/:photoId/classify')
  @SuccessMessage('success.UPDATED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Mark a photo as classified' })
  @ApiParam({ name: 'photoId', description: 'Photo UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Photo marked as classified',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async classify(@Param('photoId') photoId: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(
      new MarkPhotoClassifiedCommand(photoId, new AuditContext(user.userId)),
    )
  }

  /** Applies the same classification to multiple photos atomically. */
  @Post('photos/bulk-classify')
  @SuccessMessage('success.UPDATED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Bulk classify multiple photos with the same participant data' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'All photos classified successfully',
    type: BulkClassifyResultProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Some photos not found' })
  async bulkClassify(@Body() dto: BulkClassifyDto) {
    const command = new BulkClassifyCommand(dto.photoIds, dto.identifier ?? null, dto.colors)
    return this.commandBus.execute(command)
  }
}
