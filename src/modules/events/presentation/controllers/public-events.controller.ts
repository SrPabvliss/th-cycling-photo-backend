import {
  PublicEventDetailProjection,
  PublicEventListProjection,
  PublicPhotoProjection,
} from '@events/application/projections'
import {
  GetPublicEventDetailQuery,
  GetPublicEventPhotosDto,
  GetPublicEventPhotosQuery,
  GetPublicEventsListDto,
  GetPublicEventsListQuery,
} from '@events/application/queries'
import { Controller, Get, Param, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Pagination } from '@shared/application'
import { Public } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Public Events')
@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Public()
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List active events for public gallery' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated public event list',
    type: PublicEventListProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetPublicEventsListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(new GetPublicEventsListQuery(pagination))
  }

  @Public()
  @Get(':slug')
  @SuccessMessage('success.FETCHED', { entity: 'entities.event' })
  @ApiOperation({ summary: 'Get public event detail by slug' })
  @ApiParam({ name: 'slug', description: 'Event URL slug', example: 'vuelta-al-cotopaxi-2026' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Public event detail',
    type: PublicEventDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('slug') slug: string) {
    return this.queryBus.execute(new GetPublicEventDetailQuery(slug))
  }

  @Public()
  @Get(':slug/photos')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List completed photos for a public event (watermarked)' })
  @ApiParam({ name: 'slug', description: 'Event URL slug', example: 'vuelta-al-cotopaxi-2026' })
  @ApiQuery({ name: 'photoCategoryId', required: false, type: Number })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated list of watermarked photos',
    type: PublicPhotoProjection,
    isArray: true,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async findPhotos(@Param('slug') slug: string, @Query() dto: GetPublicEventPhotosDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(
      new GetPublicEventPhotosQuery(slug, pagination, dto.photoCategoryId ?? null),
    )
  }
}
