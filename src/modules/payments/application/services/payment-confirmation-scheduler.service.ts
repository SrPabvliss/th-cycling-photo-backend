import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { ConfirmPaymentJobData } from '@payments/infrastructure/processors/confirm-payment.processor'
import type { Queue } from 'bullmq'

@Injectable()
export class PaymentConfirmationScheduler {
  private readonly delayMs: number

  constructor(
    @InjectQueue('payment-confirmation') private readonly queue: Queue,
    config: ConfigService,
  ) {
    this.delayMs = config.get<number>('payments.expirySweepDelayMs', 900_000)
  }

  async schedule(clientTransactionId: string): Promise<void> {
    const payload: ConfirmPaymentJobData = { clientTransactionId }

    await this.queue.add('confirm', payload, {
      delay: this.delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: { age: 86_400 },
    })
  }
}
