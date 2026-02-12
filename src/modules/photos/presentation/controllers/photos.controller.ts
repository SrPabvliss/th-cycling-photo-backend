import { ClassifyPhotoCommand, ClassifyPhotoDto } from '@classifications/application/commands'
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { FilesInterceptor } from '@nestjs/platform-express'
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { UploadPhotosCommand } from '@photos/application/commands'
import { PhotoDetailProjection, PhotoListProjection } from '@photos/application/projections'
import {
  GetPhotoDetailQuery,
  GetPhotosListDto,
  GetPhotosListQuery,
  SearchPhotosDto,
  SearchPhotosQuery,
} from '@photos/application/queries'
import { EntityIdProjection, Pagination } from '@shared/application'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import { MAX_FILES, MAX_FILE_SIZE } from '../constants/upload.constants'
import { imageFileFilter } from '../filters/image-file.filter'

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

  /** Batch-uploads photos to an event. */
  @Post('events/:eventId/photos')
  @SuccessMessage('success.CREATED')
  @UseInterceptors(
    FilesInterceptor('photos', MAX_FILES, {
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload photos to an event' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Photo files (JPEG, PNG, or WebP). Max 50 files, 10 MB each.',
        },
      },
    },
  })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Photos uploaded successfully',
    type: EntityIdProjection,
    isArray: true,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Invalid file type or validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async upload(@Param('eventId') eventId: string, @UploadedFiles() files: Express.Multer.File[]) {
    const command = new UploadPhotosCommand(
      eventId,
      files.map((f) => ({
        buffer: f.buffer,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
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
