import { Body, Controller, Param, Post } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  ConfirmPaymentTransactionCommand,
  ConfirmPaymentTransactionDto,
  CreatePaymentIntentCommand,
} from '@payments/application/commands'
import { PaymentIntentProjection, PaymentResultProjection } from '@payments/application/projections'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Roles('customer')
  @Post('orders/:orderId/intent')
  @SuccessMessage('success.CREATED', { entity: 'entities.payment' })
  @ApiOperation({ summary: 'Prepare a payment box session for an order' })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Payment box parameters',
    type: PaymentIntentProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Order not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Order or seller cannot take payments' })
  async createIntent(@Param('orderId') orderId: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new CreatePaymentIntentCommand(orderId, user.userId))
  }

  @Roles('customer')
  @Post('confirm')
  @SuccessMessage('success.UPDATED', { entity: 'entities.payment' })
  @ApiOperation({ summary: 'Confirm a payment within the five minute window' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Payment outcome',
    type: PaymentResultProjection,
  })
  @ApiEnvelopeErrorResponse({
    status: 422,
    description: 'Transaction not found or gateway refused',
  })
  async confirm(@Body() dto: ConfirmPaymentTransactionDto, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(
      new ConfirmPaymentTransactionCommand(dto.clientTransactionId, String(dto.id), user.userId),
    )
  }
}
