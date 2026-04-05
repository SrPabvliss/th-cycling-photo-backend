import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { EntityIdProjection } from '@shared/application'
import { Public, Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import {
  AssignCategoryToEventCommand,
  AssignCategoryToEventDto,
  CreatePhotoCategoryCommand,
  CreatePhotoCategoryDto,
  UnassignCategoryFromEventCommand,
} from '../../application/commands'
import { PhotoCategoryProjection } from '../../application/projections'
import { GetAllCategoriesQuery, GetPhotoCategoriesQuery } from '../../application/queries'

@ApiTags('Photo Categories')
@ApiBearerAuth()
@Controller()
export class PhotoCategoriesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ─── Global category endpoints ────────────────────────────────────────────

  @Public()
  @Get('photo-categories')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List all global photo categories' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'All photo categories',
    type: PhotoCategoryProjection,
    isArray: true,
  })
  async getAll() {
    return this.queryBus.execute(new GetAllCategoriesQuery())
  }

  @Roles('admin')
  @Post('photo-categories')
  @SuccessMessage('success.CREATED', { entity: 'entities.photo_category' })
  @ApiOperation({ summary: 'Create a global photo category' })
  @ApiEnvelopeResponse({ status: 201, description: 'Category created', type: EntityIdProjection })
  @ApiEnvelopeErrorResponse({ status: 409, description: 'Category name already exists' })
  async create(@Body() dto: CreatePhotoCategoryDto) {
    return this.commandBus.execute(new CreatePhotoCategoryCommand(dto.name))
  }

  // ─── Event-scoped category endpoints ──────────────────────────────────────

  @Public()
  @Get('events/:eventId/photo-categories')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List photo categories assigned to an event' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event photo categories with photo count',
    type: PhotoCategoryProjection,
    isArray: true,
  })
  async getByEvent(@Param('eventId') eventId: string) {
    return this.queryBus.execute(new GetPhotoCategoriesQuery(eventId))
  }

  @Roles('admin')
  @Post('events/:eventId/photo-categories')
  @SuccessMessage('success.CREATED', { entity: 'entities.photo_category' })
  @ApiOperation({ summary: 'Assign a global category to an event' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({ status: 201, description: 'Category assigned', type: EntityIdProjection })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event or category not found' })
  async assignToEvent(@Param('eventId') eventId: string, @Body() dto: AssignCategoryToEventDto) {
    return this.commandBus.execute(new AssignCategoryToEventCommand(eventId, dto.photoCategoryId))
  }

  @Roles('admin')
  @Delete('events/:eventId/photo-categories/:photoCategoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unassign a category from an event' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiParam({ name: 'photoCategoryId', description: 'Photo Category ID', type: Number })
  async unassignFromEvent(
    @Param('eventId') eventId: string,
    @Param('photoCategoryId', ParseIntPipe) photoCategoryId: number,
  ) {
    await this.commandBus.execute(new UnassignCategoryFromEventCommand(eventId, photoCategoryId))
  }
}
