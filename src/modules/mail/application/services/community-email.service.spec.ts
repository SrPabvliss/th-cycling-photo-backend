import type { ConfigService } from '@nestjs/config'
import type { IUnsubscribeTokenService } from '../../domain/community'
import type { IMailer, ITemplateRenderer } from '../../domain/ports'
import { CommunityEmailService, newYearOf } from './community-email.service'

const recipient = { userId: 'user-1', email: 'daniela@example.com', firstName: 'Daniela' }

const build = (apiPublicUrl = '') => {
  const mailer: jest.Mocked<IMailer> = { send: jest.fn().mockResolvedValue(undefined) }
  const renderer: jest.Mocked<ITemplateRenderer> = {
    render: jest.fn().mockReturnValue({ html: '<p>hola</p>', text: 'hola' }),
  }
  const tokens: jest.Mocked<IUnsubscribeTokenService> = {
    sign: jest.fn().mockReturnValue('tok.sig'),
    verify: jest.fn(),
  }
  const values: Record<string, string> = {
    'app.webBaseUrl': 'https://titantv.com.ec/',
    'app.apiPublicUrl': apiPublicUrl,
    'mail.replyTo': 'info@titantv.com.ec',
  }
  const config = {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService
  return { service: new CommunityEmailService(mailer, renderer, tokens, config), mailer, renderer }
}

describe('CommunityEmailService', () => {
  it('greets by name on the birthday and links the unsubscribe page', async () => {
    const { service, mailer, renderer } = build()

    await service.send(recipient, 'birthday', '2026-12-03')

    expect(renderer.render).toHaveBeenCalledWith('birthday', {
      firstName: 'Daniela',
      headline: '¡Feliz cumpleaños, Daniela!',
      year: '2027',
      unsubscribeUrl: 'https://titantv.com.ec/email/unsubscribe?t=tok.sig',
    })
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'daniela@example.com',
        subject: '¡Feliz cumpleaños, Daniela!',
      }),
    )
  })

  it('names the year that starts in the New Year email', async () => {
    const { service, mailer } = build()

    await service.send(recipient, 'new-year', '2027-01-01')

    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ subject: '¡Feliz 2027!' }))
  })

  it('offers one-click unsubscribe only when the API public URL is HTTPS', async () => {
    const withoutApi = build()
    await withoutApi.service.send(recipient, 'christmas', '2026-12-24')
    const plain = withoutApi.mailer.send.mock.calls[0][0].headers ?? {}
    expect(plain['List-Unsubscribe']).toContain(
      '<https://titantv.com.ec/email/unsubscribe?t=tok.sig>',
    )
    expect(plain['List-Unsubscribe-Post']).toBeUndefined()

    const withApi = build('https://api.titantv.com.ec/api/v1')
    await withApi.service.send(recipient, 'christmas', '2026-12-24')
    const oneClick = withApi.mailer.send.mock.calls[0][0].headers ?? {}
    expect(oneClick['List-Unsubscribe']).toContain(
      '<https://api.titantv.com.ec/api/v1/mail/unsubscribe?token=tok.sig>',
    )
    expect(oneClick['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('marks test sends in the subject', async () => {
    const { service, mailer } = build()

    await service.send(recipient, 'christmas', '2026-11-22', { test: true })

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: '[Prueba] ¡Feliz Navidad de parte de Titan TV!' }),
    )
  })

  it('greets without a name when there is none', async () => {
    const { service, mailer } = build()

    await service.send({ ...recipient, firstName: null }, 'birthday', '2026-12-03')

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: '¡Feliz cumpleaños!' }),
    )
  })

  it('takes the coming year before January', () => {
    expect(newYearOf('2026-11-22')).toBe('2027')
    expect(newYearOf('2027-01-01')).toBe('2027')
  })
})
