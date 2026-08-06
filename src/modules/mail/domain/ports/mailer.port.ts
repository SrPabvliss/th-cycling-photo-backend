export interface MailMessage {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

export interface IMailer {
  send(message: MailMessage): Promise<void>
}

export const MAILER = Symbol('MAILER')
