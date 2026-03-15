import {
  BulkClassifyCommand,
  BulkClassifyDto,
  CreateCyclistCommand,
  CreateCyclistDto,
  DeleteCyclistCommand,
  MarkPhotoClassifiedCommand,
  UpdateCyclistCommand,
  UpdateCyclistDto,
} from '@classifications/application/commands'
import {
  BulkClassifyResultProjection,
  CyclistDetailProjection,
  CyclistListProjection,
} from '@classifications/application/projections'
import { GetCyclistDetailQuery, GetPhotoCyclistsQuery } from '@classifications/application/queries'
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { EntityIdProjection } from '@shared/application'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Classifications')
@Controller()
export class ClassificationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** Lists all detected cyclists for a given photo. */
  @Get('photos/:photoId/cyclists')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List detected cyclists for a photo' })
  @ApiParam({ name: 'photoId', description: 'Photo UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Cyclists list for the photo',
    type: CyclistListProjection,
    isArray: true,
  })
  async findAll(@Param('photoId') photoId: string) {
    return this.queryBus.execute(new GetPhotoCyclistsQuery(photoId))
  }

  /** Retrieves detailed information for a specific cyclist. */
  @Get('cyclists/:id')
  @SuccessMessage('success.FETCHED', { entity: 'entities.cyclist' })
  @ApiOperation({ summary: 'Get cyclist detail by ID' })
  @ApiParam({ name: 'id', description: 'Cyclist UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Cyclist detail retrieved',
    type: CyclistDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Cyclist not found' })
  async findOne(@Param('id') id: string) {
    return this.queryBus.execute(new GetCyclistDetailQuery(id))
  }

  /** Creates a new cyclist classification for a photo. */
  @Post('photos/:photoId/cyclists')
  @SuccessMessage('success.CREATED', { entity: 'entities.cyclist' })
  @ApiOperation({ summary: 'Create a cyclist classification for a photo' })
  @ApiParam({ name: 'photoId', description: 'Photo UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Cyclist created',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async create(@Param('photoId') photoId: string, @Body() dto: CreateCyclistDto) {
    const command = new CreateCyclistCommand(photoId, dto.plateNumber ?? null, dto.colors)
    return this.commandBus.execute(command)
  }

  /** Updates an existing cyclist classification. */
  @Patch('cyclists/:id')
  @SuccessMessage('success.UPDATED', { entity: 'entities.cyclist' })
  @ApiOperation({ summary: 'Update a cyclist classification' })
  @ApiParam({ name: 'id', description: 'Cyclist UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Cyclist updated',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Cyclist not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateCyclistDto) {
    const command = new UpdateCyclistCommand(id, dto.plateNumber, dto.colors)
    return this.commandBus.execute(command)
  }

  /** Deletes a cyclist classification. */
  @Delete('cyclists/:id')
  @SuccessMessage('success.DELETED', { entity: 'entities.cyclist' })
  @ApiOperation({ summary: 'Delete a cyclist classification' })
  @ApiParam({ name: 'id', description: 'Cyclist UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Cyclist deleted',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Cyclist not found' })
  async remove(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteCyclistCommand(id))
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
  async classify(@Param('photoId') photoId: string) {
    return this.commandBus.execute(new MarkPhotoClassifiedCommand(photoId))
  }

  /** Applies the same classification to multiple photos atomically. */
  @Post('photos/bulk-classify')
  @SuccessMessage('success.UPDATED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Bulk classify multiple photos with the same cyclist data' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'All photos classified successfully',
    type: BulkClassifyResultProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Some photos not found' })
  async bulkClassify(@Body() dto: BulkClassifyDto) {
    const command = new BulkClassifyCommand(dto.photoIds, dto.plateNumber ?? null, dto.colors)
    return this.commandBus.execute(command)
  }
}
