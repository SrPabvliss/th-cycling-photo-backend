import { Controller, Get } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import { OperatorDashboardProjection } from '../../application/projections'
import { GetOperatorDashboardQuery } from '../../application/queries/get-dashboard/get-dashboard.query'

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
}
