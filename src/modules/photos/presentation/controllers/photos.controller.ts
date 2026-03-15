import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import {
  ConfirmPhotoBatchCommand,
  ConfirmPhotoBatchDto,
  ConfirmRetouchedUploadCommand,
  ConfirmRetouchedUploadDto,
  GeneratePresignedUrlCommand,
  GeneratePresignedUrlDto,
  GenerateRetouchedPresignedUrlCommand,
  GenerateRetouchedPresignedUrlDto,
} from '@photos/application/commands'
import {
  ConfirmBatchProjection,
  DownloadUrlProjection,
  PhotoDetailProjection,
  PhotoListProjection,
  PresignedUrlProjection,
  SimilarPhotoProjection,
} from '@photos/application/projections'
import {
  FindSimilarPhotosQuery,
  GetPhotoDetailQuery,
  GetPhotoDownloadUrlQuery,
  GetPhotosListDto,
  GetPhotosListQuery,
  SearchPhotosDto,
  SearchPhotosQuery,
} from '@photos/application/queries'
import { GetDownloadManifestQuery } from '@photos/application/queries/get-download-manifest/get-download-manifest.query'
import { GetResumePointQuery } from '@photos/application/queries/get-resume-point/get-resume-point.query'
import { Pagination } from '@shared/application'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Photos')
@Controller()
export class PhotosController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** Returns the resume point (first unclassified photo) for the classification workspace. */
  @Get('events/:eventId/photos/resume-point')
  @SuccessMessage('success.FETCHED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Get resume point for classification workspace' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getResumePoint(@Param('eventId') eventId: string, @Query('limit') limit?: number) {
    return this.queryBus.execute(new GetResumePointQuery(eventId, Number(limit) || 50))
  }

  /** Returns a download manifest with presigned URLs for all event photos. */
  @Get('events/:eventId/photos/download-manifest')
  @SuccessMessage('success.FETCHED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Get download manifest for all event photos' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  async getDownloadManifest(@Param('eventId') eventId: string) {
    return this.queryBus.execute(new GetDownloadManifestQuery(eventId))
  }

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
    const query = new GetPhotosListQuery(eventId, pagination, dto.classified)
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

  /** Finds visually similar photos within the same event using vector embeddings. */
  @Get('photos/:id/similar')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'Find visually similar photos within the same event' })
  @ApiParam({ name: 'id', description: 'Photo UUID', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Similar photos found',
    type: SimilarPhotoProjection,
    isArray: true,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async findSimilar(@Param('id') id: string, @Query('limit') limit?: number) {
    const query = new FindSimilarPhotosQuery(id, limit ? Number(limit) : 10)
    return this.queryBus.execute(query)
  }

  /** Retrieves a single photo's detail. */
  @Get('photos/:id')
  @SuccessMessage('success.FETCHED', { entity: 'entities.photo' })
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
  @SuccessMessage('success.CREATED', { entity: 'entities.presigned_url' })
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
  @SuccessMessage('success.CREATED', { entity: 'entities.photo' })
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

  /** Generates a presigned URL for retouched photo upload. */
  @Post('photos/:id/retouched/presigned-url')
  @SuccessMessage('success.CREATED', { entity: 'entities.presigned_url' })
  @ApiOperation({ summary: 'Generate presigned URL for retouched photo upload' })
  @ApiParam({ name: 'id', description: 'Photo UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Presigned URL generated for retouched upload',
    type: PresignedUrlProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async generateRetouchedPresignedUrl(
    @Param('id') id: string,
    @Body() dto: GenerateRetouchedPresignedUrlDto,
  ) {
    const command = new GenerateRetouchedPresignedUrlCommand(id, dto.fileName, dto.contentType)
    return this.commandBus.execute(command)
  }

  /** Confirms a retouched photo upload. Replaces previous retouched if exists. */
  @Post('photos/:id/retouched/confirm')
  @SuccessMessage('success.UPDATED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Confirm retouched photo upload' })
  @ApiParam({ name: 'id', description: 'Photo UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Retouched photo confirmed',
    type: ConfirmBatchProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Invalid object key prefix' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async confirmRetouchedUpload(@Param('id') id: string, @Body() dto: ConfirmRetouchedUploadDto) {
    const command = new ConfirmRetouchedUploadCommand(id, dto.objectKey, dto.fileSize)
    return this.commandBus.execute(command)
  }

  /** Returns a download URL for the original or retouched photo. */
  @Get('photos/:id/download')
  @SuccessMessage('success.FETCHED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Get download URL for a photo' })
  @ApiParam({ name: 'id', description: 'Photo UUID', format: 'uuid' })
  @ApiQuery({ name: 'type', enum: ['original', 'retouched'], required: false })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Download URL retrieved',
    type: DownloadUrlProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo or retouched version not found' })
  async getDownloadUrl(@Param('id') id: string, @Query('type') type?: string) {
    const query = new GetPhotoDownloadUrlQuery(id, (type ?? 'original') as 'original' | 'retouched')
    return this.queryBus.execute(query)
  }
}
