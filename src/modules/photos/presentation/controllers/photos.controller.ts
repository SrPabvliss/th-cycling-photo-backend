import { ClassifyPhotoCommand, ClassifyPhotoDto } from '@classifications/application/commands'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  ConfirmPhotoBatchCommand,
  ConfirmPhotoBatchDto,
  GeneratePresignedUrlCommand,
  GeneratePresignedUrlDto,
} from '@photos/application/commands'
import {
  ConfirmBatchProjection,
  PhotoDetailProjection,
  PhotoListProjection,
  PresignedUrlProjection,
} from '@photos/application/projections'
import {
  GetPhotoDetailQuery,
  GetPhotosListDto,
  GetPhotosListQuery,
  SearchPhotosDto,
  SearchPhotosQuery,
} from '@photos/application/queries'
import { EntityIdProjection, Pagination } from '@shared/application'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Photos')
@Controller()
export class PhotosController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** Lists photos for a given event with pagination. */
  @Get('events/:eventId/photos')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List photos for an event with pagination' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated photo list',
    type: PhotoListProjection,
    isArray: true,
  })
  async findAll(@Param('eventId') eventId: string, @Query() dto: GetPhotosListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetPhotosListQuery(eventId, pagination)
    return this.queryBus.execute(query)
  }

  /** Searches photos across events with multi-criteria filtering. */
  @Get('photos/search')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'Search photos with multi-criteria filters' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Search results',
    type: PhotoListProjection,
    isArray: true,
  })
  async search(@Query() dto: SearchPhotosDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const { page, limit, ...filters } = dto
    const query = new SearchPhotosQuery(filters, pagination)
    return this.queryBus.execute(query)
  }

  /** Retrieves a single photo's detail with classification data. */
  @Get('photos/:id')
  @SuccessMessage('success.FETCHED')
  @ApiOperation({ summary: 'Get photo details by ID' })
  @ApiParam({ name: 'id', description: 'Photo UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Photo detail retrieved',
    type: PhotoDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async findOne(@Param('id') id: string) {
    const query = new GetPhotoDetailQuery(id)
    return this.queryBus.execute(query)
  }

  /** Generates a presigned URL for direct upload to B2. */
  @Post('events/:eventId/photos/presigned-url')
  @SuccessMessage('success.CREATED')
  @ApiOperation({ summary: 'Generate a presigned URL for direct photo upload' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Presigned URL generated',
    type: PresignedUrlProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Invalid content type' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async generatePresignedUrl(
    @Param('eventId') eventId: string,
    @Body() dto: GeneratePresignedUrlDto,
  ) {
    const command = new GeneratePresignedUrlCommand(eventId, dto.fileName, dto.contentType)
    return this.commandBus.execute(command)
  }

  /** Confirms a batch of photos uploaded directly to B2. */
  @Post('events/:eventId/photos/confirm-batch')
  @SuccessMessage('success.CREATED')
  @ApiOperation({ summary: 'Confirm a batch of photos uploaded via presigned URLs' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Photos confirmed',
    type: ConfirmBatchProjection,
  })
  @ApiEnvelopeErrorResponse({
    status: 400,
    description: 'Invalid object key prefix or validation failed',
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async confirmBatch(@Param('eventId') eventId: string, @Body() dto: ConfirmPhotoBatchDto) {
    const command = new ConfirmPhotoBatchCommand(
      eventId,
      dto.photos.map((p) => ({
        fileName: p.fileName,
        fileSize: p.fileSize,
        objectKey: p.objectKey,
        contentType: p.contentType,
      })),
    )
    return this.commandBus.execute(command)
  }

  /** Classifies a photo with detected cyclist data. */
  @Patch('photos/:id/classify')
  @SuccessMessage('success.UPDATED')
  @ApiOperation({ summary: 'Classify a photo manually' })
  @ApiParam({ name: 'id', description: 'Photo UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Photo classified successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async classify(@Param('id') id: string, @Body() dto: ClassifyPhotoDto) {
    const command = new ClassifyPhotoCommand(id, dto.cyclists)
    return this.commandBus.execute(command)
  }
}
