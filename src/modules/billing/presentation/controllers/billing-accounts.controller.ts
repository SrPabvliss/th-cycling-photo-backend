import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { EntityIdProjection } from '@shared/application'
import { CurrentUser, type ICurrentUser } from '@shared/auth'
import { Authenticated } from '@shared/authorization/presentation/decorators/authenticated.decorator'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import {
  CreateBillingAccountCommand,
  CreateBillingAccountDto,
  DeleteBillingAccountCommand,
  SetDefaultBillingAccountCommand,
} from '../../application/commands'
import { MyBillingAccountsProjection } from '../../application/projections/billing-account.projection'
import { GetMyBillingAccountsQuery } from '../../application/queries/get-my-billing-accounts/get-my-billing-accounts.query'

@ApiTags('Billing Accounts')
@ApiBearerAuth()
@Controller('users/me/billing-accounts')
export class BillingAccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Authenticated()
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List my billing accounts and whether I accepted electronic invoices' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Billing accounts',
    type: MyBillingAccountsProjection,
  })
  async findAll(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetMyBillingAccountsQuery(user.userId))
  }

  @Authenticated()
  @Post()
  @SuccessMessage('success.CREATED', { entity: 'entities.billing_account' })
  @ApiOperation({ summary: 'Add a billing account' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Billing account added',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Identification not valid' })
  async create(@Body() dto: CreateBillingAccountDto, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(
      new CreateBillingAccountCommand(
        user.userId,
        dto.idType,
        dto.idNumber,
        dto.legalName,
        dto.email,
        dto.address ?? null,
      ),
    )
  }

  @Authenticated()
  @Patch(':billingAccountId/default')
  @SuccessMessage('success.UPDATED', { entity: 'entities.billing_account' })
  @ApiOperation({ summary: 'Make a billing account the default one' })
  @ApiParam({ name: 'billingAccountId', description: 'Billing account UUID', format: 'uuid' })
  @ApiEnvelopeResponse({ status: 200, description: 'Default set', type: EntityIdProjection })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Billing account not found' })
  async setDefault(
    @Param('billingAccountId') billingAccountId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.commandBus.execute(
      new SetDefaultBillingAccountCommand(user.userId, billingAccountId),
    )
  }

  @Authenticated()
  @Delete(':billingAccountId')
  @SuccessMessage('success.DELETED', { entity: 'entities.billing_account' })
  @ApiOperation({ summary: 'Delete a billing account' })
  @ApiParam({ name: 'billingAccountId', description: 'Billing account UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Billing account deleted',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Billing account not found' })
  async remove(
    @Param('billingAccountId') billingAccountId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.commandBus.execute(new DeleteBillingAccountCommand(user.userId, billingAccountId))
  }
}
