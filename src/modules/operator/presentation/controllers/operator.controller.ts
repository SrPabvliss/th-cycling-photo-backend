import { Controller, Get, Param, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Pagination } from '@shared/application'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import { I18nLang } from 'nestjs-i18n'
import {
  DashboardSummaryProjection,
  OperatorActiveEventProjection,
  OperatorCompletedEventProjection,
  OperatorRetouchOrderDetailProjection,
  OperatorRetouchOrderProjection,
  OperatorReviewQueueItemProjection,
  RecentActivityProjection,
  RetouchQueueOrderProjection,
} from '../../application/projections'
import { GetActiveEventsDto } from '../../application/queries/get-active-events/get-active-events.dto'
import { GetActiveEventsQuery } from '../../application/queries/get-active-events/get-active-events.query'
import { GetCompletedEventsDto } from '../../application/queries/get-completed-events/get-completed-events.dto'
import { GetCompletedEventsQuery } from '../../application/queries/get-completed-events/get-completed-events.query'
import { GetDashboardSummaryQuery } from '../../application/queries/get-dashboard-summary/get-dashboard-summary.query'
import { GetOperatorRetouchOrderDetailQuery } from '../../application/queries/get-operator-retouch-order-detail/get-operator-retouch-order-detail.query'
import { GetOperatorRetouchOrdersDto } from '../../application/queries/get-operator-retouch-orders/get-operator-retouch-orders.dto'
import { GetOperatorRetouchOrdersQuery } from '../../application/queries/get-operator-retouch-orders/get-operator-retouch-orders.query'
import { GetRecentActivityDto } from '../../application/queries/get-recent-activity/get-recent-activity.dto'
import { GetRecentActivityQuery } from '../../application/queries/get-recent-activity/get-recent-activity.query'
import { GetRetouchQueueDto } from '../../application/queries/get-retouch-queue/get-retouch-queue.dto'
import { GetRetouchQueueQuery } from '../../application/queries/get-retouch-queue/get-retouch-queue.query'
import { GetOperatorReviewQueueDto } from '../../application/queries/get-review-queue/get-review-queue.dto'
import { GetOperatorReviewQueueQuery } from '../../application/queries/get-review-queue/get-review-queue.query'

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

  @Get('dashboard/review-queue')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'Cross-event review queue scoped to the operator' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated review queue items',
    type: OperatorReviewQueueItemProjection,
    isArray: true,
  })
  async getReviewQueue(@CurrentUser() user: ICurrentUser, @Query() dto: GetOperatorReviewQueueDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(
      new GetOperatorReviewQueueQuery(
        user.userId,
        pagination,
        dto.status ?? 'all',
        dto.eventSlug ?? null,
      ),
    )
  }

  @Get('retouch/orders/:orderId')
  @SuccessMessage('success.GET')
  @ApiOperation({ summary: 'Detalle de orden de retoque para el workspace' })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  @ApiQuery({
    name: 'scope',
    enum: ['pending', 'all'],
    required: false,
    description: 'Scope: solo pendientes (default) o todas las fotos de la orden',
  })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Detalle de orden con fotos según scope',
    type: OperatorRetouchOrderDetailProjection,
  })
  async getRetouchOrderDetail(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ICurrentUser,
    @Query('scope') scope?: 'pending' | 'all',
  ) {
    return this.queryBus.execute(
      new GetOperatorRetouchOrderDetailQuery(orderId, user.userId, scope ?? 'pending'),
    )
  }

  @Get('retouch/orders')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'Cross-event FIFO list of orders pending retouch for the operator' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated retouch orders ordered FIFO by creation date',
    type: OperatorRetouchOrderProjection,
    isArray: true,
  })
  async getRetouchOrders(
    @CurrentUser() user: ICurrentUser,
    @Query() dto: GetOperatorRetouchOrdersDto,
  ) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(
      new GetOperatorRetouchOrdersQuery(
        user.userId,
        pagination,
        dto.scope ?? 'pending',
        dto.eventSlug ?? null,
      ),
    )
  }

  @Get('events/:eventSlug/retouch-queue')
  @SuccessMessage('success.LIST')
  @ApiOperation({
    summary: 'Get retouch queue for an event (orders with pending retouched photos)',
  })
  @ApiParam({ name: 'eventSlug', description: 'Event slug' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated retouch queue ordered FIFO by order creation date',
    type: RetouchQueueOrderProjection,
    isArray: true,
  })
  async getRetouchQueue(
    @Param('eventSlug') eventSlug: string,
    @CurrentUser() user: ICurrentUser,
    @Query() dto: GetRetouchQueueDto,
  ) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(
      new GetRetouchQueueQuery(eventSlug, user.userId, pagination, dto.scope ?? 'pending'),
    )
  }
}
