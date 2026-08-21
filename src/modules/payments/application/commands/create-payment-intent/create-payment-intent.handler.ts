import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import type { PaymentIntentProjection } from '@payments/application/projections'
import { PaymentConfirmationScheduler } from '@payments/application/services/payment-confirmation-scheduler.service'
import { SellerAccountSuspension } from '@payments/application/services/seller-account-suspension.service'
import { PaymentTransaction } from '@payments/domain/entities'
import {
  type IOrderPaymentContextRepository,
  type IPaymentTransactionWriteRepository,
  ORDER_PAYMENT_CONTEXT_REPOSITORY,
  type OrderPaymentContext,
  PAYMENT_TRANSACTION_WRITE_REPOSITORY,
} from '@payments/domain/ports'
import { PaymentAmountCalculator } from '@payments/domain/services/payment-amount-calculator.service'
import { PaymentMode, type PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'
import { CredentialCipher } from '@shared/crypto'
import { AppException } from '@shared/domain'
import { PAYMENT_GATEWAY_REGISTRY, type PaymentGatewayRegistry } from '@shared/payment-gateways'
import { nanoid } from 'nanoid'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '../../../../tenants/domain/ports/tenant-payout-method-repository.port'
import { CreatePaymentIntentCommand } from './create-payment-intent.command'

const PAYABLE_STATUSES: string[] = [
  OrderStatus.DRAFT,
  OrderStatus.PENDING,
  OrderStatus.PAYMENT_INFO_SENT,
]
const CURRENCY = 'USD'

@CommandHandler(CreatePaymentIntentCommand)
export class CreatePaymentIntentHandler implements ICommandHandler<CreatePaymentIntentCommand> {
  constructor(
    @Inject(ORDER_PAYMENT_CONTEXT_REPOSITORY)
    private readonly contextRepo: IOrderPaymentContextRepository,
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: ITenantPayoutMethodRepository,
    @Inject(PAYMENT_TRANSACTION_WRITE_REPOSITORY)
    private readonly transactionRepo: IPaymentTransactionWriteRepository,
    @Inject(PAYMENT_GATEWAY_REGISTRY)
    private readonly registry: PaymentGatewayRegistry,
    private readonly calculator: PaymentAmountCalculator,
    private readonly cipher: CredentialCipher,
    private readonly config: ConfigService,
    private readonly scheduler: PaymentConfirmationScheduler,
    private readonly accountSuspension: SellerAccountSuspension,
  ) {}

  async execute(command: CreatePaymentIntentCommand): Promise<PaymentIntentProjection> {
    const contexts = await this.contextRepo.findByOrderIds(command.orderIds)
    if (contexts.length !== command.orderIds.length) {
      throw AppException.notFound('entities.order', command.orderIds.join(', '))
    }
    if (contexts.some((context) => context.buyerUserId !== command.buyerUserId)) {
      throw AppException.forbidden('payment.order_not_yours')
    }

    if (contexts.some((context) => context.sellerTenantId === null)) {
      throw AppException.businessRule('payment.account_not_found')
    }

    const sellerTenantIds = new Set(contexts.map((context) => context.sellerTenantId))
    if (sellerTenantIds.size > 1) throw AppException.businessRule('payment.mixed_sellers')

    const sellerTenantId = contexts[0].sellerTenantId as string

    try {
      return await this.buildIntent(contexts, sellerTenantId)
    } catch (error) {
      await this.accountSuspension.disableOnInvalidCredentials(error, sellerTenantId)
      throw error
    }
  }

  private async buildIntent(
    contexts: OrderPaymentContext[],
    sellerTenantId: string,
  ): Promise<PaymentIntentProjection> {
    if (contexts.some((context) => !PAYABLE_STATUSES.includes(context.status))) {
      throw AppException.businessRule('payment.order_not_payable')
    }
    if (contexts.some((context) => context.subtotalDollars === null)) {
      throw AppException.businessRule('payment.order_not_payable')
    }

    const account = await this.payoutRepo.findActivePayphoneForTenant(sellerTenantId)
    if (!account) throw AppException.businessRule('payment.account_not_found')
    if (!account.isUsable) throw AppException.businessRule('payment.account_not_verified')

    const gateway = this.registry.get(account.provider)
    const isSplit = account.mode === PaymentMode.SPLIT_RECEIVER

    const subtotalDollars = contexts.reduce(
      (total, context) => total + (context.subtotalDollars as number),
      0,
    )

    const amounts = this.calculator.fromSubtotal(
      subtotalDollars,
      this.config.get<number>('payments.taxRate') ?? 0,
    )
    const commissionCents = gateway.commissionCents(amounts.amountCents)
    const transferableCents = isSplit ? amounts.amountCents - commissionCents : null

    const credentials = isSplit
      ? gateway.platformCredentials()
      : JSON.parse(this.cipher.decrypt(account.credentialsEncrypted as string))
    const receiverIdentifier = isSplit
      ? (account.receiverIdentifier as string)
      : ((credentials.storeId as string) ?? 'default')

    const reference =
      contexts.length === 1
        ? `Fotos - orden ${contexts[0].orderId.slice(0, 8)}`
        : `Fotos - ${contexts.length} pedidos`

    const clientTransactionId = `tt-${nanoid(16)}`

    const intent = gateway.buildCheckoutIntent({
      clientTransactionId,
      amounts,
      credentials,
      receiverIdentifier,
      transferableCents,
      reference,
      currency: CURRENCY,
    })

    const transaction = PaymentTransaction.start({
      orderIds: contexts.map((context) => context.orderId),
      provider: account.provider,
      clientTransactionId,
      amounts,
      commissionCents,
      mode: account.mode as PaymentModeType, // repository guarantees non-null mode for active payphone rows
      receiver: receiverIdentifier,
      storeId: (credentials.storeId as string | null) ?? null,
      transferToCents: transferableCents,
    })

    await this.transactionRepo.save(transaction)
    await this.scheduler.schedule(clientTransactionId)

    return intent
  }
}
