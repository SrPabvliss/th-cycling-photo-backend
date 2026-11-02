import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'
import type { IYupanaOutboxRepository } from '@shared/yupana/domain/ports'
import { YupanaUsageReport } from '@shared/yupana/domain/yupana-usage-report'
import type { IMailer, MailMessage } from '../../domain/ports'

interface CloudflareSendResult {
  message_id?: string
  delivered?: string[]
  queued?: string[]
  permanent_bounces?: string[]
  suppressed_recipients?: string[]
}

interface CloudflareSendResponse {
  success: boolean
  result?: CloudflareSendResult
  errors?: { message: string }[]
}

@Injectable()
export class CloudflareApiMailerAdapter implements IMailer {
  private readonly logger = new Logger(CloudflareApiMailerAdapter.name)
  private readonly endpoint: string
  private readonly token: string
  private readonly from: string
  private readonly replyTo: string

  constructor(
    config: ConfigService,
    private readonly yupanaOutbox: IYupanaOutboxRepository,
  ) {
    const accountId = config.getOrThrow<string>('cloudflare.accountId')
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`
    this.token = config.getOrThrow<string>('mail.password')

    const fromName = config.getOrThrow<string>('mail.fromName')
    const fromAddress = config.getOrThrow<string>('mail.from')
    this.from = `${fromName} <${fromAddress}>`
    this.replyTo = config.getOrThrow<string>('mail.replyTo')
  }

  async send(message: MailMessage): Promise<void> {
    let response: Response
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: message.to,
          from: this.from,
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: this.replyTo,
        }),
      })
    } catch (error) {
      this.logger.error(`Failed to reach Cloudflare mail API for ${message.to}: ${message.subject}`)
      throw AppException.externalService('CloudflareApiMailer', error as Error)
    }

    if (!response.ok) {
      const errorText = await this.safeReadError(response)
      this.logger.error(
        `Cloudflare mail API responded ${response.status} for ${message.to}: ${message.subject}`,
      )
      throw AppException.externalService(
        'CloudflareApiMailer',
        new Error(`Cloudflare mail API failed: ${response.status} ${errorText}`),
      )
    }

    const payload = (await response.json()) as CloudflareSendResponse

    if (!payload.success) {
      const errorText = (payload.errors ?? []).map((e) => e.message).join(', ')
      this.logger.error(
        `Cloudflare mail API returned success=false for ${message.to}: ${message.subject}`,
      )
      throw AppException.externalService(
        'CloudflareApiMailer',
        new Error(`Cloudflare mail API returned success=false: ${errorText}`),
      )
    }

    await this.recordSend(message.to, payload.result)

    const permanentBounces = payload.result?.permanent_bounces ?? []
    if (permanentBounces.length > 0) {
      this.logger.error(
        `Cloudflare mail API reported a permanent bounce for ${message.to}: ${message.subject}`,
      )
      throw AppException.externalService(
        'CloudflareApiMailer',
        new Error(`Cloudflare mail API reported permanent bounce: ${permanentBounces.join(', ')}`),
      )
    }
  }

  private async recordSend(to: string, result: CloudflareSendResult | undefined): Promise<void> {
    if ((result?.suppressed_recipients ?? []).includes(to)) return
    const messageId = result?.message_id ?? null
    try {
      await this.yupanaOutbox.enqueue([
        YupanaUsageReport.emailSend({ messageId, occurredAt: new Date() }),
      ])
    } catch {
      this.logger.error(`Failed to record the email send ${messageId ?? 'without id'} for yupana`)
    }
  }

  private async safeReadError(response: Response): Promise<string> {
    try {
      return await response.text()
    } catch {
      return ''
    }
  }
}
