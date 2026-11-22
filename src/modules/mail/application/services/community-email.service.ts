import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  COMMUNITY_CAMPAIGN,
  type CommunityCampaign,
  type CommunityRecipient,
  type IUnsubscribeTokenService,
  UNSUBSCRIBE_PAGE_PATH,
  UNSUBSCRIBE_TOKEN_SERVICE,
} from '../../domain/community'
import { type IMailer, type ITemplateRenderer, MAILER, TEMPLATE_RENDERER } from '../../domain/ports'

/** The New Year email greets the year that starts: sent (or tested) before January, it is the next one. */
export const newYearOf = (today: string): string => {
  const year = Number(today.slice(0, 4))
  return String(today.slice(5, 7) === '01' ? year : year + 1)
}

/**
 * Builds and sends one community email. It goes straight to the mailer, outside the transactional
 * `email-delivery` queue, so a campaign never delays a verification code.
 */
@Injectable()
export class CommunityEmailService {
  private readonly webBaseUrl: string
  private readonly apiPublicUrl: string
  private readonly contactAddress: string

  constructor(
    @Inject(MAILER) private readonly mailer: IMailer,
    @Inject(TEMPLATE_RENDERER) private readonly renderer: ITemplateRenderer,
    @Inject(UNSUBSCRIBE_TOKEN_SERVICE) private readonly tokens: IUnsubscribeTokenService,
    config: ConfigService,
  ) {
    this.webBaseUrl = config.getOrThrow<string>('app.webBaseUrl').replace(/\/+$/, '')
    this.apiPublicUrl = (config.get<string>('app.apiPublicUrl') ?? '').replace(/\/+$/, '')
    this.contactAddress = config.getOrThrow<string>('mail.replyTo')
  }

  async send(
    recipient: CommunityRecipient,
    campaign: CommunityCampaign,
    today: string,
    options: { test?: boolean } = {},
  ): Promise<void> {
    const token = this.tokens.sign(recipient.userId)
    const unsubscribeUrl = `${this.webBaseUrl}${UNSUBSCRIBE_PAGE_PATH}?t=${encodeURIComponent(token)}`
    const firstName = recipient.firstName?.trim() ?? ''
    const year = newYearOf(today)
    const subject = this.subjectOf(campaign, firstName, year)

    const { html, text } = this.renderer.render(campaign, {
      firstName,
      headline: subject,
      year,
      unsubscribeUrl,
    })

    await this.mailer.send({
      to: recipient.email,
      subject: options.test ? `[Prueba] ${subject}` : subject,
      html,
      text,
      headers: this.unsubscribeHeaders(token, unsubscribeUrl),
    })
  }

  private subjectOf(campaign: CommunityCampaign, firstName: string, year: string): string {
    switch (campaign) {
      case COMMUNITY_CAMPAIGN.BIRTHDAY:
        return firstName ? `¡Feliz cumpleaños, ${firstName}!` : '¡Feliz cumpleaños!'
      case COMMUNITY_CAMPAIGN.CHRISTMAS:
        return '¡Feliz Navidad de parte de Titan TV!'
      case COMMUNITY_CAMPAIGN.NEW_YEAR:
        return `¡Feliz ${year}!`
    }
  }

  /**
   * One-click unsubscribe (RFC 8058) needs an HTTPS endpoint that takes a POST, so it is only
   * offered when the API's public URL is configured; the web page link and mailto always are.
   */
  private unsubscribeHeaders(token: string, unsubscribeUrl: string): Record<string, string> {
    const mailto = `<mailto:${this.contactAddress}?subject=Baja%20de%20correos%20de%20fechas%20especiales>`
    if (!this.apiPublicUrl.startsWith('https://')) {
      return { 'List-Unsubscribe': `<${unsubscribeUrl}>, ${mailto}` }
    }
    return {
      'List-Unsubscribe': `<${this.apiPublicUrl}/mail/unsubscribe?token=${encodeURIComponent(token)}>, ${mailto}`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  }
}
