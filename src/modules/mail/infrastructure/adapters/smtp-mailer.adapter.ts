import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'
import { createTransport, type SendMailOptions, type Transporter } from 'nodemailer'
import type { IMailer, MailMessage } from '../../domain/ports'

@Injectable()
export class SmtpMailerAdapter implements IMailer {
  private readonly logger = new Logger(SmtpMailerAdapter.name)
  private readonly transporter: Transporter
  private readonly from: string
  private readonly replyTo: string

  constructor(config: ConfigService) {
    this.transporter = createTransport({
      host: config.getOrThrow<string>('mail.host'),
      port: config.getOrThrow<number>('mail.port'),
      secure: true,
      auth: {
        user: config.getOrThrow<string>('mail.user'),
        pass: config.getOrThrow<string>('mail.password'),
      },
    })

    const fromName = config.getOrThrow<string>('mail.fromName')
    const fromAddress = config.getOrThrow<string>('mail.from')
    this.from = `${fromName} <${fromAddress}>`
    this.replyTo = config.getOrThrow<string>('mail.replyTo')
  }

  async send(message: MailMessage): Promise<void> {
    await this.sendMail({
      from: this.from,
      replyTo: this.replyTo,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers ?? {},
    })
  }

  private async sendMail(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail(options)
    } catch (error) {
      this.logger.error(`Failed to send mail to ${options.to}: ${options.subject}`, error)
      throw AppException.externalService('SmtpMailer', error as Error)
    }
  }
}
