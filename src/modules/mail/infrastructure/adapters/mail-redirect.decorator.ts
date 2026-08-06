import type { IMailer, MailMessage } from '../../domain/ports'

export class MailRedirectDecorator implements IMailer {
  constructor(
    private readonly inner: IMailer,
    private readonly redirectTo: string,
  ) {}

  async send(message: MailMessage): Promise<void> {
    if (!this.redirectTo) {
      await this.inner.send(message)
      return
    }

    const banner = `Envío desviado. Destinatario real: ${message.to}`

    await this.inner.send({
      to: this.redirectTo,
      subject: `[DEV -> ${message.to}] ${message.subject}`,
      html: `<div style="background:#fff3cd;border:1px solid #f59e0b;padding:12px;font-family:sans-serif;font-size:13px;">${banner}</div>${message.html}`,
      text: `${banner}\n\n${message.text}`,
      headers: { ...message.headers, 'X-Original-To': message.to },
    })
  }
}
