import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import type { Queue } from 'bullmq'
import type { EmailJobData } from '../../infrastructure/processors/email-delivery.processor'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)

  constructor(@InjectQueue('email-delivery') private readonly queue: Queue) {}

  async enqueue(payload: EmailJobData): Promise<void> {
    await this.queue.add('send', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: { age: 1800 },
    })
    this.logger.log(`Enqueued ${payload.template} email for ${payload.to}`)
  }
}
