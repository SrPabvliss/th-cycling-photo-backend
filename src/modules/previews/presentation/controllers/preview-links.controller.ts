import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { CreatePreviewLinkCommand, CreatePreviewLinkDto } from '@previews/application/commands'
import {
  PreviewLinkCreatedProjection,
  PreviewLinkListProjection,
} from '@previews/application/projections'
import { GetPreviewLinksListDto, GetPreviewLinksListQuery } from '@previews/application/queries'
import { AuditContext, Pagination } from '@shared/application'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Preview Links')
@ApiBearerAuth()
@Controller('events/:eventId/preview-links')
export class PreviewLinksController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Roles('admin')
  @Post()
  @SuccessMessage('success.CREATED', { entity: 'entities.preview_link' })
  @ApiOperation({ summary: 'Create a preview link for an event' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Preview link created successfully',
    type: PreviewLinkCreatedProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreatePreviewLinkDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const command = new CreatePreviewLinkCommand(
      eventId,
      dto.photoIds,
      dto.expiresInDays ?? 7,
      new AuditContext(user.userId),
    )
    return this.commandBus.execute(command)
  }

  @Roles('admin')
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List preview links for an event' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated preview link list',
    type: PreviewLinkListProjection,
    isArray: true,
  })
  async findAll(@Param('eventId') eventId: string, @Query() dto: GetPreviewLinksListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetPreviewLinksListQuery(eventId, pagination)
    return this.queryBus.execute(query)
  }
}
