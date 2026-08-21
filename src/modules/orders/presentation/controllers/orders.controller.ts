import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import {
  CancelOrderCommand,
  ConfirmOrderPaymentCommand,
  ConvertOrderToGiftCommand,
  ConvertOrderToSaleCommand,
  GiftOrderCommand,
  NotifyPaymentInfoCommand,
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
import { CurrentUser, type ICurrentUser } from '@shared/auth'
import { AllowedWhenFrozen } from '@shared/authorization/presentation/decorators/freeze-policy.decorator'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @RequirePermission('order.read')
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List orders with filters' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated order list',
    type: OrderListProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetOrdersListDto, @CurrentUser() user: ICurrentUser) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetOrdersListQuery(
      pagination,
      {
        eventId: dto.eventId,
        status: dto.status,
        search: dto.search,
      },
      user.userId,
    )
    return this.queryBus.execute(query)
  }

  @RequirePermission('order.stats.read')
  @Get('stats')
  @SuccessMessage('success.FETCHED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Get order statistics, optionally scoped to an event' })
  @ApiQuery({ name: 'eventId', required: false, description: 'Scope stats to a single event' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order statistics retrieved',
    type: OrdersStatsProjection,
  })
  async getStats(@Query('eventId') eventId: string | undefined, @CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetOrdersStatsQuery(eventId, user.userId))
  }

  @RequirePermission('order.read')
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
  async findOne(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetOrderDetailQuery(id, user.userId))
  }

  @RequirePermission('order.notify_payment')
  @AllowedWhenFrozen()
  @Patch(':id/notify-payment-info')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({
    summary: 'Mark payment info as sent (pending → payment_info_sent). Idempotent on re-notify.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Payment info notification recorded',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not pending' })
  async notifyPaymentInfo(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const command = new NotifyPaymentInfoCommand(id, new AuditContext(user.userId))
    return this.commandBus.execute(command)
  }

  @RequirePermission('order.confirm_payment')
  @AllowedWhenFrozen()
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

  @RequirePermission('order.gift')
  @AllowedWhenFrozen()
  @Patch(':id/gift')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({
    summary:
      'Mark order as a gift (pending | payment_info_sent → gifted). Terminal status, excluded from revenue.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order marked as gifted',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not pending' })
  async gift(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new GiftOrderCommand(id, new AuditContext(user.userId)))
  }

  @RequirePermission('order.convert_to_sale')
  @AllowedWhenFrozen()
  @Patch(':id/convert-to-sale')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({
    summary:
      'Convert a gifted order back to a sale (gifted → paid, or → delivered if it was already delivered). Its subtotal starts counting toward revenue.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order converted to a sale',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not gifted' })
  async convertToSale(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new ConvertOrderToSaleCommand(id, new AuditContext(user.userId)))
  }

  @RequirePermission('order.convert_to_gift')
  @AllowedWhenFrozen()
  @Patch(':id/convert-to-gift')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({
    summary:
      'Convert a sale into a gift (paid | delivered → gifted, keeping deliveredAt). Its subtotal stops counting toward revenue.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order converted to a gift',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not paid or delivered' })
  async convertToGift(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new ConvertOrderToGiftCommand(id, new AuditContext(user.userId)))
  }

  @RequirePermission('order.deliver')
  @AllowedWhenFrozen()
  @Patch(':id/send-delivery')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({
    summary:
      'Generate delivery link and send photos. Sale: paid → delivered. Gift: sets deliveredAt, keeps status gifted.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Delivery link generated, order delivered',
    type: OrderPaymentConfirmedProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not paid' })
  async sendDelivery(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new SendDeliveryCommand(id, new AuditContext(user.userId)))
  }

  @RequirePermission('order.delivery.regenerate')
  @AllowedWhenFrozen()
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
  async regenerateDelivery(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new RegenerateDeliveryCommand(id, new AuditContext(user.userId)))
  }

  @RequirePermission('order.cancel')
  @AllowedWhenFrozen()
  @Patch(':id/cancel')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({
    summary: 'Cancel an order (pending | payment_info_sent | paid | gifted → cancelled)',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Order cancelled',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order is not cancellable' })
  async cancel(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new CancelOrderCommand(id, user.userId))
  }
}
