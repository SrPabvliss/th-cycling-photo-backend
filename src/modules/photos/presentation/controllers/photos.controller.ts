import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import { BulkCategoryResultProjection } from '@photo-categories/application/projections'
import {
  AddPhotoBibCommand,
  AddPhotoBibDto,
  AddPhotoColorCommand,
  AddPhotoColorDto,
  ApplyBibCorrectionCommand,
  ApplyBibCorrectionDto,
  ApplyColorCorrectionCommand,
  ApplyColorCorrectionDto,
  BulkAssignCategoryCommand,
  BulkAssignCategoryDto,
  ConfirmPhotoBatchCommand,
  ConfirmPhotoBatchDto,
  ConfirmRetouchedUploadCommand,
  ConfirmRetouchedUploadDto,
  GeneratePresignedUrlCommand,
  GeneratePresignedUrlDto,
  GenerateRetouchedPresignedUrlCommand,
  GenerateRetouchedPresignedUrlDto,
  MarkPhotoReviewedCommand,
} from '@photos/application/commands'
import {
  ConfirmBatchProjection,
  DownloadUrlProjection,
  PendingRetouchOrderProjection,
  PhotoDetailProjection,
  PhotoListProjection,
  PhotoViewProjection,
  PresignedUrlProjection,
  ReviewQueueItemProjection,
  SimilarPhotoProjection,
} from '@photos/application/projections'
import {
  FindSimilarPhotosQuery,
  GetPendingRetouchQuery,
  GetPhotoDetailBySlugQuery,
  GetPhotoDetailQuery,
  GetPhotoDownloadUrlQuery,
  GetPhotosListDto,
  GetPhotosListQuery,
  GetReviewQueueDto,
  GetReviewQueueQuery,
  SearchPhotosDto,
  SearchPhotosQuery,
} from '@photos/application/queries'
import { GetDownloadManifestQuery } from '@photos/application/queries/get-download-manifest/get-download-manifest.query'
import { GetPhotoViewQuery } from '@photos/application/queries/get-photo-view/get-photo-view.query'
import { GetResumePointQuery } from '@photos/application/queries/get-resume-point/get-resume-point.query'
import { AuditContext, EntityIdProjection, Pagination } from '@shared/application'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Photos')
@ApiBearerAuth()
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
  @Roles('admin')
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
    const query = new GetPhotosListQuery(eventId, pagination, dto.classified, dto.photoCategoryId)
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

  /** Returns paid orders with photos pending retouching, ordered FIFO. */
  @Roles('admin', 'operator')
  @Get('photos/pending-retouch')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'Get photos pending retouching grouped by order' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Pending retouch orders',
    type: PendingRetouchOrderProjection,
    isArray: true,
  })
  async getPendingRetouch() {
    return this.queryBus.execute(new GetPendingRetouchQuery())
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

  /** Retrieves a lightweight photo view by public slug. */
  @Get('photos/view/:slug')
  @SuccessMessage('success.FETCHED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Get lightweight photo view by slug' })
  @ApiParam({ name: 'slug', description: 'Photo public slug' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Photo view retrieved',
    type: PhotoViewProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.queryBus.execute(new GetPhotoViewQuery(slug))
  }

  /** Retrieves a single photo's full detail (admin/operator) by public slug. */
  @Roles('admin', 'operator')
  @Get('photos/detail/:slug')
  @SuccessMessage('success.FETCHED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Get photo full detail by slug (admin/operator)' })
  @ApiParam({ name: 'slug', description: 'Photo public slug' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Photo detail retrieved',
    type: PhotoDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo not found' })
  async findDetailBySlug(@Param('slug') slug: string) {
    return this.queryBus.execute(new GetPhotoDetailBySlugQuery(slug))
  }

  /** Apply a digits correction to a specific bib (admin/operator). */
  @Roles('admin', 'operator')
  @Post('photos/:photoId/bibs/:bibId/corrections')
  @SuccessMessage('success.UPDATED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Apply bib digits correction' })
  @ApiParam({ name: 'photoId', description: 'Photo UUID', format: 'uuid' })
  @ApiParam({ name: 'bibId', description: 'PhotoBib UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Correction applied (or no-op if value unchanged)',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Photo or bib not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Photo is being processed' })
  async applyBibCorrection(
    @Param('photoId') photoId: string,
    @Param('bibId') bibId: string,
    @Body() body: ApplyBibCorrectionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.commandBus.execute(
      new ApplyBibCorrectionCommand(photoId, bibId, body.newValue, user.userId),
    )
  }

  /** Apply a primary or secondary color correction to a specific color attribute (admin/operator). */
  @Roles('admin', 'operator')
  @Post('photos/:photoId/colors/:colorId/corrections')
  @SuccessMessage('success.UPDATED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Apply color correction (primary or secondary)' })
  @ApiParam({ name: 'photoId', format: 'uuid' })
  @ApiParam({ name: 'colorId', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Correction applied (or no-op if value unchanged)',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Photo is being processed' })
  async applyColorCorrection(
    @Param('photoId') photoId: string,
    @Param('colorId') colorId: string,
    @Body() body: ApplyColorCorrectionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.commandBus.execute(
      new ApplyColorCorrectionCommand(photoId, colorId, body.field, body.newValue, user.userId),
    )
  }

  /** Mark a photo as reviewed (idempotente set-only — never reverts) (admin/operator). */
  @Roles('admin', 'operator')
  @Post('photos/:photoId/reviewed')
  @HttpCode(200)
  @SuccessMessage('success.UPDATED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Mark photo as reviewed (idempotente set-only)' })
  @ApiParam({ name: 'photoId', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Photo marked reviewed',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Photo is being processed' })
  async markPhotoReviewed(@Param('photoId') photoId: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new MarkPhotoReviewedCommand(photoId, user.userId))
  }

  /** Add a manual reviewer-sourced bib to a photo (admin/operator). */
  @Roles('admin', 'operator')
  @Post('photos/:photoId/bibs')
  @SuccessMessage('success.CREATED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Add manual bib (reviewer-sourced)' })
  @ApiParam({ name: 'photoId', format: 'uuid' })
  @ApiEnvelopeResponse({ status: 201, description: 'Manual bib created', type: EntityIdProjection })
  async addPhotoBib(
    @Param('photoId') photoId: string,
    @Body() body: AddPhotoBibDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.commandBus.execute(
      new AddPhotoBibCommand(photoId, body.digits, body.status, user.userId),
    )
  }

  /** Add a manual reviewer-sourced color to a photo (admin/operator). */
  @Roles('admin', 'operator')
  @Post('photos/:photoId/colors')
  @SuccessMessage('success.CREATED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Add manual color (reviewer-sourced)' })
  @ApiParam({ name: 'photoId', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Manual color created',
    type: EntityIdProjection,
  })
  async addPhotoColor(
    @Param('photoId') photoId: string,
    @Body() body: AddPhotoColorDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.commandBus.execute(
      new AddPhotoColorCommand(
        photoId,
        body.region,
        body.primaryColor,
        body.secondaryColor ?? null,
        user.userId,
      ),
    )
  }

  /** Paginated review queue for an event, ordered by min(bib confidence) ASC NULLS FIRST (admin/operator). */
  @Roles('admin', 'operator')
  @Get('events/:eventSlug/review-queue')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'Review queue ordered by min(bib confidence) ASC NULLS FIRST' })
  @ApiParam({ name: 'eventSlug', description: 'Event public slug' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated review queue',
    type: ReviewQueueItemProjection,
    isArray: true,
  })
  async getReviewQueue(@Param('eventSlug') eventSlug: string, @Query() dto: GetReviewQueueDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 50)
    const status = dto.status ?? 'all'
    return this.queryBus.execute(new GetReviewQueueQuery(eventSlug, pagination, status))
  }

  /** Retrieves a single photo's full detail (used by workspace). */
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
  @Roles('admin')
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
  @Roles('admin')
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
  async confirmBatch(
    @Param('eventId') eventId: string,
    @Body() dto: ConfirmPhotoBatchDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const command = new ConfirmPhotoBatchCommand(
      eventId,
      dto.photos.map((p) => ({
        fileName: p.fileName,
        fileSize: p.fileSize,
        objectKey: p.objectKey,
        contentType: p.contentType,
      })),
      new AuditContext(user.userId),
      dto.photoCategoryId ?? null,
    )
    return this.commandBus.execute(command)
  }

  /** Generates a presigned URL for retouched photo upload. */
  @Roles('admin', 'operator')
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
  @Roles('admin', 'operator')
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
  async confirmRetouchedUpload(
    @Param('id') id: string,
    @Body() dto: ConfirmRetouchedUploadDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const command = new ConfirmRetouchedUploadCommand(id, dto.objectKey, dto.fileSize, user.userId)
    return this.commandBus.execute(command)
  }

  /** Returns a download URL for the original or retouched photo. */
  @Roles('admin')
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

  @Roles('admin')
  @Patch('photos/bulk-category')
  @SuccessMessage('success.UPDATED', { entity: 'entities.photo' })
  @ApiOperation({ summary: 'Bulk assign or remove category from multiple photos' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Photos updated',
    type: BulkCategoryResultProjection,
  })
  async bulkAssignCategory(@Body() dto: BulkAssignCategoryDto) {
    const command = new BulkAssignCategoryCommand(dto.photoIds, dto.photoCategoryId ?? null)
    return this.commandBus.execute(command)
  }
}
