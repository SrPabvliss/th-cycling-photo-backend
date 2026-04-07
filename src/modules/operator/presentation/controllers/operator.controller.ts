import { Controller, Get, Param } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import { OperatorDashboardProjection, RetouchQueueProjection } from '../../application/projections'
import { GetOperatorDashboardQuery } from '../../application/queries/get-dashboard/get-dashboard.query'
import { GetRetouchQueueQuery } from '../../application/queries/get-retouch-queue/get-retouch-queue.query'

@ApiTags('Operator')
@ApiBearerAuth()
@Roles('operator')
@Controller('operator')
export class OperatorController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('dashboard')
  @SuccessMessage('success.FETCHED', { entity: 'entities.dashboard' })
  @ApiOperation({ summary: 'Get operator dashboard with assigned events and progress' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Operator dashboard data',
    type: OperatorDashboardProjection,
  })
  async getDashboard(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetOperatorDashboardQuery(user.userId))
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
