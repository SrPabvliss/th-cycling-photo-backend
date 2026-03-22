import { Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { CancelOrderCommand, ConfirmOrderPaymentCommand } from '@orders/application/commands'
import {
  OrderDetailProjection,
  OrderListProjection,
  OrderPaymentConfirmedProjection,
} from '@orders/application/projections'
import {
  GetOrderDetailQuery,
  GetOrdersListDto,
  GetOrdersListQuery,
} from '@orders/application/queries'
import { AuditContext, EntityIdProjection, Pagination } from '@shared/application'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Roles('admin')
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List orders with filters' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated order list',
    type: OrderListProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetOrdersListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetOrdersListQuery(pagination, {
      eventId: dto.eventId,
      status: dto.status,
      search: dto.search,
    })
    return this.queryBus.execute(query)
  }

  @Roles('admin')
  @Get(':id')
  @SuccessMessage('success.FETCHED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Get order detail' })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order detail retrieved',
    type: OrderDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  async findOne(@Param('id') id: string) {
    return this.queryBus.execute(new GetOrderDetailQuery(id))
  }

  @Roles('admin')
  @Patch(':id/confirm-payment')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Confirm payment and generate delivery link' })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Payment confirmed, delivery link generated',
    type: OrderPaymentConfirmedProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not pending' })
  async confirmPayment(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const command = new ConfirmOrderPaymentCommand(id, new AuditContext(user.userId))
    return this.commandBus.execute(command)
  }

  @Roles('admin')
  @Patch(':id/cancel')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Cancel a pending order' })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order cancelled',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not pending' })
  async cancel(@Param('id') id: string) {
    return this.commandBus.execute(new CancelOrderCommand(id))
  }
}
