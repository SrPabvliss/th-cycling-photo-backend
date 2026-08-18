import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { PaymentIntentProjection } from '@payments/application/projections'
import { PaymentConfirmationScheduler } from '@payments/application/services/payment-confirmation-scheduler.service'
import { SellerAccountSuspension } from '@payments/application/services/seller-account-suspension.service'
import { PaymentTransaction } from '@payments/domain/entities'
import {
  type IOrderPaymentContextRepository,
  type IPaymentTransactionReadRepository,
  type IPaymentTransactionWriteRepository,
  type ISellerPaymentAccountReadRepository,
  ORDER_PAYMENT_CONTEXT_REPOSITORY,
  type OrderPaymentContext,
  PAYMENT_TRANSACTION_READ_REPOSITORY,
  PAYMENT_TRANSACTION_WRITE_REPOSITORY,
  SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY,
} from '@payments/domain/ports'
import { PaymentAmountCalculator } from '@payments/domain/services/payment-amount-calculator.service'
import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { CredentialCipher } from '@shared/crypto'
import { AppException } from '@shared/domain'
import { PAYMENT_GATEWAY_REGISTRY, type PaymentGatewayRegistry } from '@shared/payment-gateways'
import { nanoid } from 'nanoid'
import { CreatePaymentIntentCommand } from './create-payment-intent.command'

const PAYABLE_STATUSES = ['pending', 'payment_info_sent']
const CURRENCY = 'USD'

@CommandHandler(CreatePaymentIntentCommand)
export class CreatePaymentIntentHandler implements ICommandHandler<CreatePaymentIntentCommand> {
  constructor(
    @Inject(ORDER_PAYMENT_CONTEXT_REPOSITORY)
    private readonly contextRepo: IOrderPaymentContextRepository,
    @Inject(SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY)
    private readonly accountRepo: ISellerPaymentAccountReadRepository,
    @Inject(PAYMENT_TRANSACTION_WRITE_REPOSITORY)
    private readonly transactionRepo: IPaymentTransactionWriteRepository,
    @Inject(PAYMENT_TRANSACTION_READ_REPOSITORY)
    private readonly transactionReadRepo: IPaymentTransactionReadRepository,
    @Inject(PAYMENT_GATEWAY_REGISTRY)
    private readonly registry: PaymentGatewayRegistry,
    private readonly calculator: PaymentAmountCalculator,
    private readonly cipher: CredentialCipher,
    private readonly config: ConfigService,
    private readonly scheduler: PaymentConfirmationScheduler,
    private readonly accountSuspension: SellerAccountSuspension,
  ) {}

  async execute(command: CreatePaymentIntentCommand): Promise<PaymentIntentProjection> {
    const context = await this.contextRepo.findByOrderId(command.orderId)
    if (!context) throw AppException.notFound('entities.order', command.orderId)
    if (context.buyerUserId !== command.buyerUserId) {
      throw AppException.forbidden('payment.order_not_yours')
    }

    try {
      return await this.buildIntent(context)
    } catch (error) {
      await this.accountSuspension.disableOnInvalidCredentials(error, context.sellerUserId)
      throw error
    }
  }

  private async buildIntent(context: OrderPaymentContext): Promise<PaymentIntentProjection> {
    if (!PAYABLE_STATUSES.includes(context.status)) {
      throw AppException.businessRule('payment.order_not_payable')
    }
    if (context.subtotalDollars === null) {
      throw AppException.businessRule('payment.order_not_payable')
    }

    const account = await this.accountRepo.findByUserId(context.sellerUserId)
    if (!account) throw AppException.businessRule('payment.account_not_found')
    if (!account.isUsable) throw AppException.businessRule('payment.account_not_verified')

    const gateway = this.registry.get(account.provider)
    const isSplit = account.mode === PaymentMode.SPLIT_RECEIVER

    const amounts = this.calculator.fromSubtotal(
      context.subtotalDollars,
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

    const active = await this.transactionReadRepo.findActiveByOrderId(context.orderId)
    const reference = `Fotos - orden ${context.orderId.slice(0, 8)}`

    if (active) {
      return gateway.buildCheckoutIntent({
        clientTransactionId: active.clientTransactionId,
        amounts: {
          amountCents: active.amountCents,
          amountWithoutTaxCents: active.amountWithoutTaxCents,
          amountWithTaxCents: active.amountWithTaxCents,
          taxCents: active.taxCents,
        },
        credentials: { ...credentials, storeId: active.storeIdSnapshot },
        receiverIdentifier,
        transferableCents: isSplit ? active.transferToCents : null,
        reference,
        currency: CURRENCY,
      })
    }

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
      orderId: context.orderId,
      provider: account.provider,
      clientTransactionId,
      amounts,
      commissionCents,
      mode: account.mode,
      receiver: receiverIdentifier,
      storeId: (credentials.storeId as string | null) ?? null,
      transferToCents: transferableCents,
    })

    await this.transactionRepo.save(transaction)
    await this.scheduler.schedule(clientTransactionId)

    return intent
  }
}
