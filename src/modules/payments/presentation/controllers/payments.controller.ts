import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  ConfirmPaymentTransactionCommand,
  ConfirmPaymentTransactionDto,
  CreatePaymentIntentCommand,
  CreatePaymentIntentDto,
} from '@payments/application/commands'
import {
  PaymentIntentProjection,
  PaymentResultProjection,
  PaymentTransactionProjection,
} from '@payments/application/projections'
import { GetPaymentTransactionQuery } from '@payments/application/queries'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Roles('customer')
  @Post('intent')
  @SuccessMessage('success.CREATED', { entity: 'entities.payment' })
  @ApiOperation({ summary: 'Prepare one payment box session covering a group of orders' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Payment box parameters',
    type: PaymentIntentProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'One of the orders was not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Orders or seller cannot take payments' })
  async createIntent(@Body() dto: CreatePaymentIntentDto, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new CreatePaymentIntentCommand(dto.orderIds, user.userId))
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

  @Roles('customer')
  @Get('transactions/:clientTransactionId')
  @ApiOperation({ summary: 'Read a payment attempt the buyer started' })
  @ApiParam({ name: 'clientTransactionId', description: 'Identifier this platform generated' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Payment attempt',
    type: PaymentTransactionProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 403, description: 'The transaction belongs to someone else' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Transaction not found' })
  async getTransaction(
    @Param('clientTransactionId') clientTransactionId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.queryBus.execute(new GetPaymentTransactionQuery(clientTransactionId, user.userId))
  }
}
