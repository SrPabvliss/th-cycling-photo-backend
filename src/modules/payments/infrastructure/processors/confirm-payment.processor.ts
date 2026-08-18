import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { ConfirmPaymentTransactionCommand } from '@payments/application/commands'
import {
  type IOrderPaymentContextRepository,
  type IPaymentTransactionReadRepository,
  type IPaymentTransactionWriteRepository,
  ORDER_PAYMENT_CONTEXT_REPOSITORY,
  PAYMENT_TRANSACTION_READ_REPOSITORY,
  PAYMENT_TRANSACTION_WRITE_REPOSITORY,
} from '@payments/domain/ports'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import type { Job } from 'bullmq'

export interface ConfirmPaymentJobData {
  clientTransactionId: string
}

const CONFIRM_CONCURRENCY = Number.parseInt(process.env.PAYMENT_CONFIRM_CONCURRENCY ?? '5', 10)

const SETTLEABLE_ORDER_STATUSES: string[] = [OrderStatus.PENDING, OrderStatus.PAYMENT_INFO_SENT]

@Processor('payment-confirmation', { concurrency: CONFIRM_CONCURRENCY })
export class ConfirmPaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(ConfirmPaymentProcessor.name)

  constructor(
    @Inject(PAYMENT_TRANSACTION_READ_REPOSITORY)
    private readonly readRepo: IPaymentTransactionReadRepository,
    @Inject(PAYMENT_TRANSACTION_WRITE_REPOSITORY)
    private readonly writeRepo: IPaymentTransactionWriteRepository,
    @Inject(ORDER_PAYMENT_CONTEXT_REPOSITORY)
    private readonly contextRepo: IOrderPaymentContextRepository,
    private readonly commandBus: CommandBus,
  ) {
    super()
  }

  async process(job: Job<ConfirmPaymentJobData>): Promise<void> {
    const { clientTransactionId } = job.data

    const current = await this.readRepo.findByClientTransactionId(clientTransactionId)
    if (!current) return

    if (current.isSettled) {
      if (current.status !== PaymentTransactionStatus.APPROVED) return

      if (current.gatewayTransactionId == null) {
        this.logger.warn(
          `Approved payment ${clientTransactionId} has no gateway transaction id, skipping healing dispatch`,
        )
        return
      }

      const context = await this.contextRepo.findByOrderId(current.orderId)
      if (!context) {
        this.logger.warn(
          `Approved payment ${clientTransactionId} has no order context, skipping healing dispatch`,
        )
        return
      }

      if (!SETTLEABLE_ORDER_STATUSES.includes(context.status)) return

      await this.commandBus.execute(
        new ConfirmPaymentTransactionCommand(
          clientTransactionId,
          current.gatewayTransactionId,
          context.buyerUserId,
        ),
      )
      return
    }

    await this.writeRepo.runLocked(clientTransactionId, async (transaction) => {
      if (transaction.isSettled) return
      transaction.markExpired()
      this.logger.error(
        `Payment was never confirmed and the vendor will have reversed it. clientTransactionId=${clientTransactionId} orderId=${transaction.orderId}`,
      )
    })
  }
}
