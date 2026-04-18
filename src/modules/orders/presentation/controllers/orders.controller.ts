import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  CancelOrderCommand,
  ConfirmOrderPaymentCommand,
  RegenerateDeliveryCommand,
  SendDeliveryCommand,
} from '@orders/application/commands'
import {
  OrderDetailProjection,
  OrderListProjection,
  OrderPaymentConfirmedProjection,
  OrdersStatsProjection,
} from '@orders/application/projections'
import {
  GetOrderDetailQuery,
  GetOrdersListDto,
  GetOrdersListQuery,
  GetOrdersStatsQuery,
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
  @Get('stats')
  @SuccessMessage('success.FETCHED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Get order statistics' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order statistics retrieved',
    type: OrdersStatsProjection,
  })
  async getStats() {
    return this.queryBus.execute(new GetOrdersStatsQuery())
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
  @ApiOperation({ summary: 'Confirm payment (pending → paid)' })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Payment confirmed',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not pending' })
  async confirmPayment(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const command = new ConfirmOrderPaymentCommand(id, new AuditContext(user.userId))
    return this.commandBus.execute(command)
  }

  @Roles('admin')
  @Patch(':id/send-delivery')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Generate delivery link and send photos (paid → delivered)' })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Delivery link generated, order delivered',
    type: OrderPaymentConfirmedProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not paid' })
  async sendDelivery(@Param('id') id: string) {
    return this.commandBus.execute(new SendDeliveryCommand(id))
  }

  @Roles('admin')
  @Post(':id/regenerate-delivery')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Regenerate expired delivery link' })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'New delivery link generated',
    type: OrderPaymentConfirmedProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not delivered' })
  async regenerateDelivery(@Param('id') id: string) {
    return this.commandBus.execute(new RegenerateDeliveryCommand(id))
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
