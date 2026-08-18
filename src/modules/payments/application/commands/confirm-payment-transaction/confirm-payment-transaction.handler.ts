import { Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { ConfirmOrderPaymentCommand } from '@orders/application/commands'
import type { OrderStatusType } from '@orders/domain/value-objects/order-status.vo'
import type { PaymentResultProjection } from '@payments/application/projections'
import { SellerAccountSuspension } from '@payments/application/services/seller-account-suspension.service'
import type { PaymentTransaction } from '@payments/domain/entities'
import {
  type IOrderPaymentContextRepository,
  type IPaymentTransactionWriteRepository,
  type ISellerPaymentAccountReadRepository,
  ORDER_PAYMENT_CONTEXT_REPOSITORY,
  PAYMENT_TRANSACTION_WRITE_REPOSITORY,
  SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY,
} from '@payments/domain/ports'
import {
  decideOrderSettlement,
  OrderSettlementDecision,
} from '@payments/domain/services/order-settlement-policy'
import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import { AuditContext } from '@shared/application'
import { CredentialCipher } from '@shared/crypto'
import { AppException } from '@shared/domain'
import {
  type GatewayCredentials,
  type IPaymentGateway,
  PAYMENT_GATEWAY_REGISTRY,
  type PaymentGatewayRegistry,
} from '@shared/payment-gateways'
import { ConfirmPaymentTransactionCommand } from './confirm-payment-transaction.command'

@CommandHandler(ConfirmPaymentTransactionCommand)
export class ConfirmPaymentTransactionHandler
  implements ICommandHandler<ConfirmPaymentTransactionCommand>
{
  private readonly logger = new Logger(ConfirmPaymentTransactionHandler.name)
  private readonly systemUserId: string

  constructor(
    @Inject(PAYMENT_TRANSACTION_WRITE_REPOSITORY)
    private readonly transactionRepo: IPaymentTransactionWriteRepository,
    @Inject(SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY)
    private readonly accountRepo: ISellerPaymentAccountReadRepository,
    @Inject(ORDER_PAYMENT_CONTEXT_REPOSITORY)
    private readonly contextRepo: IOrderPaymentContextRepository,
    @Inject(PAYMENT_GATEWAY_REGISTRY)
    private readonly registry: PaymentGatewayRegistry,
    private readonly cipher: CredentialCipher,
    private readonly commandBus: CommandBus,
    private readonly config: ConfigService,
    private readonly accountSuspension: SellerAccountSuspension,
  ) {
    this.systemUserId = this.config.getOrThrow<string>('payments.systemUserId')
  }

  async execute(command: ConfirmPaymentTransactionCommand): Promise<PaymentResultProjection> {
    let sellerUserId: string | undefined

    const runConfirmation = () =>
      this.transactionRepo.runLocked(command.clientTransactionId, async (transaction) => {
        const context = await this.contextRepo.findByOrderId(transaction.orderId)
        if (!context) throw AppException.businessRule('payment.order_context_missing')
        if (context.buyerUserId !== command.buyerUserId) {
          throw AppException.forbidden('payment.order_not_yours')
        }

        sellerUserId = context.sellerUserId

        if (transaction.isSettled) {
          return {
            approved: transaction.status === PaymentTransactionStatus.APPROVED,
            orderId: transaction.orderId,
            message: transaction.failureMessage,
          }
        }

        transaction.beginConfirmation()

        const gateway = this.registry.get(transaction.provider)
        const credentials = await this.resolveCredentials(transaction, gateway)
        const result = await gateway.confirm({
          gatewayTransactionId: command.gatewayTransactionId,
          clientTransactionId: transaction.clientTransactionId,
          credentials,
        })

        if (!result.approved) {
          transaction.markDeclined(result)
          return { approved: false, orderId: transaction.orderId, message: result.message }
        }

        if (result.amountCents !== transaction.amountCents) {
          this.logger.error(
            `The gateway charged an amount that does not match the order. clientTransactionId=${transaction.clientTransactionId} orderId=${transaction.orderId} expectedAmountCents=${transaction.amountCents} chargedAmountCents=${result.amountCents}`,
          )
          transaction.markDeclined(result)
          return { approved: false, orderId: transaction.orderId, message: result.message }
        }

        transaction.markApproved(result)
        return { approved: true, orderId: transaction.orderId, message: null }
      })

    let outcome: PaymentResultProjection
    try {
      outcome = await runConfirmation()
    } catch (error) {
      await this.accountSuspension.disableOnInvalidCredentials(error, sellerUserId)
      throw error
    }

    if (outcome.approved) {
      await this.settleOrder(command.clientTransactionId, outcome.orderId)
    }

    return outcome
  }

  private async settleOrder(clientTransactionId: string, orderId: string): Promise<void> {
    const shouldSettle = await this.transactionRepo.runLocked(clientTransactionId, async () => {
      const context = await this.contextRepo.findByOrderId(orderId)

      if (!context) {
        this.logger.error(
          `Approved payment cannot settle its order: no order context found. clientTransactionId=${clientTransactionId} orderId=${orderId}`,
        )
        return false
      }

      const decision = decideOrderSettlement(context.status as OrderStatusType)

      if (decision === OrderSettlementDecision.SETTLE) {
        return true
      }

      if (decision === OrderSettlementDecision.ALREADY_SETTLED) {
        this.logger.error(
          `Approved payment landed on an order that is already settled. clientTransactionId=${clientTransactionId} orderId=${orderId} orderStatus=${context.status}`,
        )
        return false
      }

      this.logger.error(
        `Approved payment cannot settle its order: order status does not allow settlement. clientTransactionId=${clientTransactionId} orderId=${orderId} orderStatus=${context.status}`,
      )
      return false
    })

    if (!shouldSettle) return

    try {
      await this.commandBus.execute(
        new ConfirmOrderPaymentCommand(orderId, new AuditContext(this.systemUserId)),
      )
    } catch (error) {
      this.logger.error(
        `Approved payment could not settle its order. clientTransactionId=${clientTransactionId} orderId=${orderId} reason=${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async resolveCredentials(
    transaction: PaymentTransaction,
    gateway: IPaymentGateway,
  ): Promise<GatewayCredentials> {
    if (transaction.modeSnapshot === PaymentMode.SPLIT_RECEIVER) {
      return { ...gateway.platformCredentials(), storeId: transaction.storeIdSnapshot }
    }

    const context = await this.contextRepo.findByOrderId(transaction.orderId)
    if (!context) throw AppException.businessRule('payment.order_context_missing')

    const account = await this.accountRepo.findByUserId(context.sellerUserId)
    if (!account?.credentialsEncrypted) {
      throw AppException.businessRule('payment.invalid_credentials')
    }

    return {
      ...JSON.parse(this.cipher.decrypt(account.credentialsEncrypted)),
      storeId: transaction.storeIdSnapshot,
    }
  }
}
