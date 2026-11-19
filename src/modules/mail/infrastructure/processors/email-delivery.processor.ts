import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import { AppException } from '@shared/domain'
import type { Job } from 'bullmq'
import type { IMailer, ITemplateRenderer, MailTemplate } from '../../domain/ports'
import { MAILER, TEMPLATE_RENDERER } from '../../domain/ports'

export interface EmailJobData {
  to: string
  subject: string
  template: MailTemplate
  vars: Record<string, string>
  replyTo?: string
}

/** The provider's own reason travels in the exception context, not in its i18n message key. */
function describeFailure(error: unknown): string {
  if (error instanceof AppException) {
    const cause = error.context?.originalError
    return typeof cause === 'string' && cause.length > 0
      ? `${error.messageKey}: ${cause}`
      : error.messageKey
  }
  return error instanceof Error ? error.message : String(error)
}

const EMAIL_DELIVERY_CONCURRENCY = Number.parseInt(
  process.env.EMAIL_DELIVERY_CONCURRENCY ?? '5',
  10,
)

@Processor('email-delivery', { concurrency: EMAIL_DELIVERY_CONCURRENCY })
export class EmailDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailDeliveryProcessor.name)

  constructor(
    @Inject(MAILER) private readonly mailer: IMailer,
    @Inject(TEMPLATE_RENDERER) private readonly renderer: ITemplateRenderer,
  ) {
    super()
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, template, vars, replyTo } = job.data

    try {
      const { html, text } = this.renderer.render(template, vars)
      await this.mailer.send({ to, subject, html, text, replyTo })
      this.logger.log(`Sent ${template} to ${to}`)
    } catch (error) {
      const attempt = `attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1}`
      this.logger.error(
        `Failed to send ${template} to ${to} (${attempt}): ${describeFailure(error)}`,
      )
      throw error
    }
  }
}
