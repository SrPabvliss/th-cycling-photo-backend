export type MailTemplate =
  | 'password-reset'
  | 'password-changed'
  | 'order-delivered'
  | 'email-verification-code'
  | 'email-changed-notice'
  | 'tenant-contract-invitation'

export interface RenderedTemplate {
  html: string
  text: string
}

export interface ITemplateRenderer {
  render(template: MailTemplate, vars: Record<string, string>): RenderedTemplate
}

export const TEMPLATE_RENDERER = Symbol('TEMPLATE_RENDERER')
