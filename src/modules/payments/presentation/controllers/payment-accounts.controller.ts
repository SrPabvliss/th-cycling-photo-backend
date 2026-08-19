import { Body, Controller, Get, Put } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  ConfigurePaymentAccountCommand,
  ConfigurePaymentAccountDto,
} from '@payments/application/commands'
import { PaymentAccountProjection } from '@payments/application/projections'
import { GetPaymentAccountQuery } from '@payments/application/queries'
import { EntityIdProjection } from '@shared/application'
import { CurrentUser, type ICurrentUser } from '@shared/auth'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payphone-account')
export class PaymentAccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @RequirePermission('payment.account.read')
  @Get()
  @SuccessMessage('success.FETCHED', { entity: 'entities.payphone_account' })
  @ApiOperation({ summary: 'Get the payment account configured by the current user' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Payment account configuration',
    type: PaymentAccountProjection,
  })
  async findMine(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetPaymentAccountQuery(user.userId))
  }

  @RequirePermission('payment.account.configure')
  @Put()
  @SuccessMessage('success.UPDATED', { entity: 'entities.payphone_account' })
  @ApiOperation({ summary: 'Configure and verify the payment account of the current user' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Payment account verified',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Phone or credentials rejected' })
  async configure(@Body() dto: ConfigurePaymentAccountDto, @CurrentUser() user: ICurrentUser) {
    const command = new ConfigurePaymentAccountCommand(
      user.userId,
      dto.mode,
      dto.phone ?? null,
      dto.token ?? null,
      dto.storeId ?? null,
    )
    return this.commandBus.execute(command)
  }
}
