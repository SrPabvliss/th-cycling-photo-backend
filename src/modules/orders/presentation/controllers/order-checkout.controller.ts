import { Body, Controller, Patch } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ChoosePaymentMethodCommand, ChoosePaymentMethodDto } from '@orders/application/commands'
import { OrderPaymentMethodProjection } from '@orders/application/projections'
import { CurrentUser, type ICurrentUser } from '@shared/auth'
import { AllowedWhenFrozen } from '@shared/authorization/presentation/decorators/freeze-policy.decorator'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Orders (Checkout)')
@ApiBearerAuth()
@Controller('orders')
export class OrderCheckoutController {
  constructor(private readonly commandBus: CommandBus) {}

  @RequirePermission('order.payment_method.set')
  @AllowedWhenFrozen()
  @Patch('payment-method')
  @SuccessMessage('success.UPDATED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Record the payment method the buyer chose for a group of orders' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Payment method recorded for the order group',
    type: OrderPaymentMethodProjection,
  })
  @ApiEnvelopeErrorResponse({
    status: 403,
    description: 'One of the orders belongs to someone else',
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'One of the orders does not exist' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'One of the orders is already settled' })
  async choosePaymentMethod(
    @Body() dto: ChoosePaymentMethodDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.commandBus.execute(
      new ChoosePaymentMethodCommand(dto.orderIds, dto.method, user.userId),
    )
  }
}
