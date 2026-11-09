import { SettleCartCommand } from '@cart/application/commands'
import { Inject, Logger } from '@nestjs/common'
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { ConfirmOrderPaymentCommand, SendDeliveryCommand } from '@orders/application/commands'
import type { OrderPaymentConfirmedProjection } from '@orders/application/projections'
import type { OrderStatusType } from '@orders/domain/value-objects/order-status.vo'
import type {
  PaymentDeliveryProjection,
  PaymentResultProjection,
} from '@payments/application/projections'
import { PaymentSystemActor } from '@payments/application/services/payment-system-actor.service'
import { SellerAccountSuspension } from '@payments/application/services/seller-account-suspension.service'
import type { PaymentTransaction } from '@payments/domain/entities'
import {
  type IOrderPaymentContextRepository,
  type IPaymentTransactionWriteRepository,
  ORDER_PAYMENT_CONTEXT_REPOSITORY,
  PAYMENT_TRANSACTION_WRITE_REPOSITORY,
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
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '../../../../tenants/domain/ports/tenant-payout-method-repository.port'
import { ConfirmPaymentTransactionCommand } from './confirm-payment-transaction.command'

type ConfirmationOutcome = Omit<PaymentResultProjection, 'deliveries' | 'settled'>

@CommandHandler(ConfirmPaymentTransactionCommand)
export class ConfirmPaymentTransactionHandler
  implements ICommandHandler<ConfirmPaymentTransactionCommand>
{
  private readonly logger = new Logger(ConfirmPaymentTransactionHandler.name)

  constructor(
    @Inject(PAYMENT_TRANSACTION_WRITE_REPOSITORY)
    private readonly transactionRepo: IPaymentTransactionWriteRepository,
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: ITenantPayoutMethodRepository,
    @Inject(ORDER_PAYMENT_CONTEXT_REPOSITORY)
    private readonly contextRepo: IOrderPaymentContextRepository,
    @Inject(PAYMENT_GATEWAY_REGISTRY)
    private readonly registry: PaymentGatewayRegistry,
    private readonly cipher: CredentialCipher,
    private readonly commandBus: CommandBus,
    private readonly accountSuspension: SellerAccountSuspension,
    private readonly systemActor: PaymentSystemActor,
  ) {}

  async execute(command: ConfirmPaymentTransactionCommand): Promise<PaymentResultProjection> {
    let sellerTenantId: string | null | undefined

    const runConfirmation = () =>
      this.transactionRepo.runLocked(command.clientTransactionId, async (transaction) => {
        const contexts = await this.contextRepo.findByOrderIds(transaction.orderIds)
        if (contexts.length === 0) throw AppException.businessRule('payment.order_context_missing')
        if (contexts.length !== transaction.orderIds.length) {
          const foundOrderIds = new Set(contexts.map((context) => context.orderId))
          const unresolvedOrderIds = transaction.orderIds.filter(
            (orderId) => !foundOrderIds.has(orderId),
          )
          this.logger.error(
            `Approved payment is confirming with an incomplete order group: some order ids did not resolve to a context. clientTransactionId=${transaction.clientTransactionId} unresolvedOrderIds=${unresolvedOrderIds.join(',')}`,
          )
        }
        if (contexts.some((context) => context.buyerUserId !== command.buyerUserId)) {
          throw AppException.forbidden('payment.order_not_yours')
        }

        sellerTenantId = contexts[0].sellerTenantId

        const wasExpired = transaction.status === PaymentTransactionStatus.EXPIRED

        if (transaction.isSettled && !wasExpired) {
          return {
            approved: transaction.status === PaymentTransactionStatus.APPROVED,
            orderIds: transaction.orderIds,
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
          return { approved: false, orderIds: transaction.orderIds, message: result.message }
        }

        if (result.amountCents !== transaction.amountCents) {
          this.logger.error(
            `The gateway charged an amount that does not match the order. clientTransactionId=${transaction.clientTransactionId} orderIds=${transaction.orderIds.join(',')} expectedAmountCents=${transaction.amountCents} chargedAmountCents=${result.amountCents}`,
          )
          transaction.markDeclined(result)
          return { approved: false, orderIds: transaction.orderIds, message: result.message }
        }

        if (wasExpired) {
          this.logger.error(
            `A gateway-approved payment revived a transaction we had marked expired. clientTransactionId=${transaction.clientTransactionId} orderIds=${transaction.orderIds.join(',')}`,
          )
        }

        transaction.markApproved(result)
        return { approved: true, orderIds: transaction.orderIds, message: null }
      })

    let outcome: ConfirmationOutcome
    try {
      outcome = await runConfirmation()
    } catch (error) {
      await this.accountSuspension.disableOnInvalidCredentials(error, sellerTenantId)
      throw error
    }

    if (!outcome.approved) return { ...outcome, settled: false, deliveries: [] }

    const { settledOrderIds, deliveries } = await this.settleOrders(
      command.clientTransactionId,
      outcome.orderIds,
      command.buyerUserId,
    )

    return {
      ...outcome,
      settled: settledOrderIds.length === outcome.orderIds.length,
      deliveries,
    }
  }

  private async settleOrders(
    clientTransactionId: string,
    orderIds: string[],
    buyerUserId: string,
  ): Promise<{ settledOrderIds: string[]; deliveries: PaymentDeliveryProjection[] }> {
    const settleable = await this.transactionRepo.runLocked(clientTransactionId, async () => {
      const contexts = await this.contextRepo.findByOrderIds(orderIds)
      const foundOrderIds = new Set(contexts.map((context) => context.orderId))

      const unresolvedOrderIds = orderIds.filter((orderId) => !foundOrderIds.has(orderId))
      unresolvedOrderIds.forEach((orderId) => {
        this.logger.error(
          `Approved payment cannot settle its order: no order context found. clientTransactionId=${clientTransactionId} orderId=${orderId}`,
        )
      })

      const decisions = contexts.map((context) => ({
        context,
        decision: decideOrderSettlement(context.status as OrderStatusType),
      }))

      const hasUnsettleableOrder = decisions.some(
        ({ decision }) => decision === OrderSettlementDecision.NOT_SETTLEABLE,
      )

      decisions
        .filter(({ decision }) => decision !== OrderSettlementDecision.SETTLE)
        .forEach(({ context, decision }) => {
          const logMethod = decision === OrderSettlementDecision.ALREADY_SETTLED ? 'log' : 'error'
          this.logger[logMethod](
            `Approved payment did not settle one of its orders. clientTransactionId=${clientTransactionId} orderId=${context.orderId} orderStatus=${context.status} decision=${decision}`,
          )
        })

      const settleableOrderIds = decisions
        .filter(({ decision }) => decision === OrderSettlementDecision.SETTLE)
        .map(({ context }) => context.orderId)

      const isGenuinelyStranded = unresolvedOrderIds.length > 0 || hasUnsettleableOrder

      if (orderIds.length > 0 && settleableOrderIds.length === 0 && isGenuinelyStranded) {
        this.logger.error(
          `Approved payment settled none of its orders. clientTransactionId=${clientTransactionId} orderIds=${orderIds.join(',')}`,
        )
      }

      return settleableOrderIds
    })

    const settledResults = await Promise.all(
      settleable.map(async (orderId) => {
        try {
          await this.commandBus.execute(
            new ConfirmOrderPaymentCommand(orderId, new AuditContext(this.systemActor.userId)),
          )
          return orderId
        } catch (error) {
          this.logger.error(
            `Approved payment could not settle its order. clientTransactionId=${clientTransactionId} orderId=${orderId} reason=${error instanceof Error ? error.message : String(error)}`,
          )
          return null
        }
      }),
    )

    const settledOrderIds = settledResults.filter((orderId): orderId is string => orderId !== null)

    if (settledOrderIds.length > 0) {
      try {
        await this.commandBus.execute(new SettleCartCommand(buyerUserId, settledOrderIds))
      } catch (error) {
        this.logger.error(
          `Approved payment settled its orders but could not settle the buyer's cart. clientTransactionId=${clientTransactionId} orderIds=${settledOrderIds.join(',')} reason=${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    const deliveries = await this.deliverOrders(clientTransactionId, settledOrderIds)
    return { settledOrderIds, deliveries }
  }

  private async deliverOrders(
    clientTransactionId: string,
    orderIds: string[],
  ): Promise<PaymentDeliveryProjection[]> {
    const results = await Promise.all(
      orderIds.map(async (orderId) => {
        try {
          const delivery = await this.commandBus.execute<
            SendDeliveryCommand,
            OrderPaymentConfirmedProjection
          >(new SendDeliveryCommand(orderId, new AuditContext(this.systemActor.userId)))

          if (!delivery?.deliveryUrl || !delivery.token) return null

          return {
            orderId,
            eventName: delivery.eventName,
            token: delivery.token,
          }
        } catch (error) {
          this.logger.error(
            `A paid order could not be delivered automatically. clientTransactionId=${clientTransactionId} orderId=${orderId} reason=${error instanceof Error ? error.message : String(error)}`,
          )
          return null
        }
      }),
    )

    return results.filter((delivery): delivery is PaymentDeliveryProjection => delivery !== null)
  }

  private async resolveCredentials(
    transaction: PaymentTransaction,
    gateway: IPaymentGateway,
  ): Promise<GatewayCredentials> {
    if (transaction.modeSnapshot === PaymentMode.SPLIT_RECEIVER) {
      return { ...gateway.platformCredentials(), storeId: transaction.storeIdSnapshot }
    }

    const contexts = await this.contextRepo.findByOrderIds(transaction.orderIds)
    if (contexts.length === 0) throw AppException.businessRule('payment.order_context_missing')

    const sellerTenantId = contexts[0].sellerTenantId
    if (!sellerTenantId) throw AppException.businessRule('payment.account_not_found')

    const account = await this.payoutRepo.findActivePayphoneForTenant(sellerTenantId)
    if (!account?.credentialsEncrypted) {
      throw AppException.businessRule('payment.invalid_credentials')
    }

    return {
      ...JSON.parse(this.cipher.decrypt(account.credentialsEncrypted)),
      storeId: transaction.storeIdSnapshot,
    }
  }
}
