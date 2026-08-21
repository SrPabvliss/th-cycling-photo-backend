import { Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { CancelMyOrderCommand } from '@orders/application/commands'
import {
  MyOrderDetailProjection,
  MyOrderDownloadsProjection,
  MyOrderListProjection,
  MyOrdersSummaryProjection,
} from '@orders/application/projections'
import {
  GetMyOrderDetailQuery,
  GetMyOrderDownloadsQuery,
  GetMyOrdersListDto,
  GetMyOrdersListQuery,
  GetMyOrdersSummaryQuery,
} from '@orders/application/queries'
import { EntityIdProjection, Pagination } from '@shared/application'
import { CurrentUser, type ICurrentUser } from '@shared/auth'
import { Authenticated } from '@shared/authorization/presentation/decorators/authenticated.decorator'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('My Orders')
@ApiBearerAuth()
@Controller('orders/me')
export class OrderAccountController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Authenticated()
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List my own orders' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated list of the customer own orders',
    type: MyOrderListProjection,
    isArray: true,
  })
  async findMine(@CurrentUser() user: ICurrentUser, @Query() dto: GetMyOrdersListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(new GetMyOrdersListQuery(user.userId, pagination))
  }

  @Authenticated()
  @Get('summary')
  @SuccessMessage('success.FETCHED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Get aggregate figures over all of my orders' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order counts, photo count, event count and spend per currency',
    type: MyOrdersSummaryProjection,
  })
  async summary(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetMyOrdersSummaryQuery(user.userId))
  }

  @Authenticated()
  @Get(':id')
  @SuccessMessage('success.FETCHED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Get one of my orders' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order detail with watermarked photos',
    type: MyOrderDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  async findMineById(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.queryBus.execute(new GetMyOrderDetailQuery(user.userId, id))
  }

  @Authenticated()
  @Get(':id/downloads')
  @SuccessMessage('success.FETCHED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Get presigned download URLs for one of my orders' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Presigned download URLs',
    type: MyOrderDownloadsProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order has nothing to download yet' })
  async downloads(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.queryBus.execute(new GetMyOrderDownloadsQuery(user.userId, id))
  }

  @Authenticated()
  @Patch(':id/cancel')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Cancel one of my orders while it is still in process' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order cancelled',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order cannot be cancelled' })
  async cancelMine(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.commandBus.execute(new CancelMyOrderCommand(user.userId, id))
  }
}
