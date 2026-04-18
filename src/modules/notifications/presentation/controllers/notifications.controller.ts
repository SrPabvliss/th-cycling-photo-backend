import { Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { MarkAllReadCommand, MarkAsReadCommand } from '@notifications/application/commands'
import {
  NotificationProjection,
  UnreadCountProjection,
} from '@notifications/application/projections'
import {
  GetNotificationsListDto,
  GetNotificationsListQuery,
  GetUnreadCountQuery,
} from '@notifications/application/queries'
import { EntityIdProjection, Pagination } from '@shared/application'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Roles('admin', 'operator')
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List notifications for the current user' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated notification list',
    type: NotificationProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetNotificationsListDto, @CurrentUser() user: ICurrentUser) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(new GetNotificationsListQuery(user.userId, pagination, dto.isRead))
  }

  @Roles('admin', 'operator')
  @Get('unread-count')
  @SuccessMessage('success.FETCHED', { entity: 'entities.notification' })
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Unread count retrieved',
    type: UnreadCountProjection,
  })
  async getUnreadCount(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetUnreadCountQuery(user.userId))
  }

  @Roles('admin', 'operator')
  @Patch('read-all')
  @SuccessMessage('success.UPDATED', { entity: 'entities.notification' })
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new MarkAllReadCommand(user.userId))
  }

  @Roles('admin', 'operator')
  @Patch(':id/read')
  @SuccessMessage('success.UPDATED', { entity: 'entities.notification' })
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Notification marked as read',
    type: EntityIdProjection,
  })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new MarkAsReadCommand(user.userId, id))
  }
}
