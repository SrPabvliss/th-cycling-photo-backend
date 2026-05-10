import { Controller, Get, Param, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Pagination } from '@shared/application'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import { I18nLang } from 'nestjs-i18n'
import {
  DashboardSummaryProjection,
  OperatorActiveEventProjection,
  OperatorCompletedEventProjection,
  RecentActivityProjection,
  RetouchQueueProjection,
} from '../../application/projections'
import { GetActiveEventsDto } from '../../application/queries/get-active-events/get-active-events.dto'
import { GetActiveEventsQuery } from '../../application/queries/get-active-events/get-active-events.query'
import { GetCompletedEventsDto } from '../../application/queries/get-completed-events/get-completed-events.dto'
import { GetCompletedEventsQuery } from '../../application/queries/get-completed-events/get-completed-events.query'
import { GetDashboardSummaryQuery } from '../../application/queries/get-dashboard-summary/get-dashboard-summary.query'
import { GetRecentActivityDto } from '../../application/queries/get-recent-activity/get-recent-activity.dto'
import { GetRecentActivityQuery } from '../../application/queries/get-recent-activity/get-recent-activity.query'
import { GetRetouchQueueQuery } from '../../application/queries/get-retouch-queue/get-retouch-queue.query'

@ApiTags('Operator')
@ApiBearerAuth()
@Roles('operator')
@Controller('operator')
export class OperatorController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('dashboard/summary')
  @SuccessMessage('success.FETCHED', { entity: 'entities.dashboard' })
  @ApiOperation({ summary: 'Get operator dashboard KPI summary' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Dashboard summary KPIs',
    type: DashboardSummaryProjection,
  })
  async getSummary(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetDashboardSummaryQuery(user.userId))
  }

  @Get('dashboard/events/active')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List operator active assigned events with progress' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated active events',
    type: OperatorActiveEventProjection,
    isArray: true,
  })
  async getActiveEvents(@CurrentUser() user: ICurrentUser, @Query() dto: GetActiveEventsDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(new GetActiveEventsQuery(user.userId, pagination))
  }

  @Get('dashboard/events/completed')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List operator completed assigned events' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated completed events',
    type: OperatorCompletedEventProjection,
    isArray: true,
  })
  async getCompletedEvents(@CurrentUser() user: ICurrentUser, @Query() dto: GetCompletedEventsDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(new GetCompletedEventsQuery(user.userId, pagination))
  }

  @Get('dashboard/recent-activity')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'Recent activity (review + retouch) of the operator' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated recent activity',
    type: RecentActivityProjection,
    isArray: true,
  })
  async getRecentActivity(
    @CurrentUser() user: ICurrentUser,
    @Query() dto: GetRecentActivityDto,
    @I18nLang() lang: string,
  ) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 10)
    return this.queryBus.execute(new GetRecentActivityQuery(user.userId, pagination, lang))
  }

  @Get('events/:eventId/retouch-queue')
  @SuccessMessage('success.LIST')
  @ApiOperation({
    summary: 'Get retouch queue for an event (orders with pending retouched photos)',
  })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Retouch queue ordered FIFO by order creation date',
    type: RetouchQueueProjection,
  })
  async getRetouchQueue(@Param('eventId') eventId: string, @CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetRetouchQueueQuery(eventId, user.userId))
  }
}
