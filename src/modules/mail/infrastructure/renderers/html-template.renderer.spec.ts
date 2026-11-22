import type { MailTemplate } from '../../domain/ports'
import { HtmlTemplateRenderer } from './html-template.renderer'

const SAMPLES: Record<MailTemplate, Record<string, string>> = {
  'email-verification-code': { firstName: 'Daniela', code: '482913', ttlMinutes: '15' },
  'email-changed-notice': { firstName: 'Daniela', newEmail: 'daniela@example.com' },
  'password-reset': {
    firstName: 'Daniela',
    resetUrl: 'https://titantv.com.ec/reset-password#t=abc',
    ttlMinutes: '30',
  },
  'password-changed': { firstName: 'Daniela', changedDate: '22 nov 2026', changedTime: '10:42' },
  'order-delivered': {
    firstName: 'Daniela',
    eventName: 'Mama Rumi 2026',
    photoCount: '12',
    total: '$18.00',
    deliveryUrl: 'https://titantv.com.ec/d/abc',
    expiresOn: '6 de diciembre',
  },
  'invoice-rejected': {
    firstName: 'Daniela',
    eventName: 'Mama Rumi 2026',
    orderRef: '8f3a21c0',
    reason: 'La identificación del comprador no es válida',
    correctUrl: 'https://titantv.com.ec/account/orders/8f3a21c0',
  },
  'tenant-contract-invitation': {
    firstName: 'Andrés',
    commercialName: 'Ciclismo Andino',
    eventsTotal: '10',
    photosPerEvent: '300',
    validUntil: '31 de diciembre de 2027',
    url: 'https://titantv.com.ec/contrato/abc',
  },
  'tenant-contact-request': {
    organizerName: 'Ciclismo Andino',
    organizerEmail: 'andres@example.com',
    tenantId: 'c4e1',
    reasonLabel: 'Más cupo de eventos',
    eventsWanted: '5',
    message: 'Queremos cubrir cinco fechas más.',
    contractStatus: 'Vigente',
    contractName: 'Ciclismo Andino 2026',
    eventsUsed: '8',
    eventsTotal: '10',
    validUntil: '31 de diciembre de 2026',
  },
  'tenant-contact-confirmation': {
    firstName: 'Andrés',
    reasonLabel: 'Más cupo de eventos',
    eventsWanted: '5',
    message: 'Queremos cubrir cinco fechas más.',
  },
  welcome: { firstName: 'Daniela', eventsUrl: 'https://titantv.com.ec/eventos' },
  birthday: {
    firstName: 'Daniela',
    headline: '¡Feliz cumpleaños, Daniela!',
    unsubscribeUrl: 'https://titantv.com.ec/correos/baja?t=abc',
  },
  christmas: { firstName: 'Daniela', unsubscribeUrl: 'https://titantv.com.ec/correos/baja?t=abc' },
  'new-year': {
    firstName: 'Daniela',
    year: '2027',
    unsubscribeUrl: 'https://titantv.com.ec/correos/baja?t=abc',
  },
}

describe('HtmlTemplateRenderer', () => {
  const renderer = new HtmlTemplateRenderer()

  it('should substitute variables into the reset template', () => {
    const result = renderer.render('password-reset', {
      firstName: 'Pablo',
      resetUrl: 'https://titantv.com.ec/reset-password#t=abc.def',
      logoUrl: 'https://titantv.com.ec/brand/logo-email.png',
    })

    expect(result.html).toContain('Pablo')
    expect(result.html).not.toContain('{{')
  })

  it('should derive a non-empty plain-text alternative', () => {
    const result = renderer.render('password-reset', {
      firstName: 'Pablo',
      resetUrl: 'https://titantv.com.ec/reset-password#t=abc.def',
      logoUrl: 'https://titantv.com.ec/brand/logo-email.png',
    })

    expect(result.text).toContain('Pablo')
    expect(result.text).toContain('https://titantv.com.ec/reset-password#t=abc.def')
    expect(result.text).not.toContain('<td')
  })

  it('should escape user-supplied firstName to prevent markup injection', () => {
    const result = renderer.render('password-reset', {
      firstName: '<img src=x onerror=alert(1)>',
      resetUrl: 'https://titantv.com.ec/reset-password#t=abc.def',
      logoUrl: 'https://titantv.com.ec/brand/logo-email.png',
    })

    expect(result.html).not.toContain('<img src=x onerror=alert(1)>')
  })

  it('should render the password-changed template', () => {
    const result = renderer.render('password-changed', {
      firstName: 'Pablo',
      changedTime: '15:30',
      changedDate: '5 ago 2026',
      logoUrl: 'https://titantv.com.ec/brand/logo-email.png',
    })

    expect(result.html).toContain('15:30')
    expect(result.html).toContain('5 ago 2026')
    expect(result.html).not.toContain('{{')
  })

  it('should greet neutrally in the invoice-rejected template when the name is empty', () => {
    const result = renderer.render('invoice-rejected', {
      firstName: '',
      eventName: 'Gran Fondo',
      orderRef: 'abcd1234',
      reason: '39: RUC invalido',
      correctUrl: 'https://titantv.com.ec/account/orders/abcd1234',
      logoUrl: 'https://titantv.com.ec/brand/logo-email.png',
    })

    expect(result.html).toContain('Hola, el SRI')
    expect(result.html).not.toContain('Hola ,')
    expect(result.html).not.toContain('{{')
  })

  describe.each(Object.entries(SAMPLES))('the %s template', (template, vars) => {
    const result = renderer.render(template as MailTemplate, vars)

    it('resolves every variable and stays under Gmail clipping size', () => {
      expect(result.html).not.toMatch(/{{|}}|undefined|\[object /)
      expect(Buffer.byteLength(result.html, 'utf8')).toBeLessThan(102 * 1024)
    })

    it('uses the shared layout, its bridge illustration and the front-served images', () => {
      expect(result.html).toContain('https://titantv.com.ec/brand/email/lockup-navy@3x.png')
      expect(result.html).toMatch(/brand\/email\/bridge-[a-z0-9-]+@2x\.png/)
      expect(result.html).toContain(`&copy; ${new Date().getFullYear()} Titan TV`)
    })
  })

  it('shows the unsubscribe link only on community emails', () => {
    expect(renderer.render('christmas', SAMPLES.christmas).html).toContain(
      'Dejar de recibir estos correos',
    )
    expect(renderer.render('welcome', SAMPLES.welcome).html).not.toContain(
      'Dejar de recibir estos correos',
    )
  })

  it('draws the new-year bridge and title for the given year', () => {
    const html = renderer.render('new-year', SAMPLES['new-year']).html
    expect(html).toContain('bridge-calendario-anio-2027@2x.png')
    expect(html).toContain('¡Feliz 2027!')
  })

  it('offers community emails in the welcome only to who has not activated them', () => {
    expect(renderer.render('welcome', SAMPLES.welcome).html).toContain(
      'Correos de fechas especiales',
    )
    expect(
      renderer.render('welcome', { ...SAMPLES.welcome, communityEmails: 'true' }).html,
    ).not.toContain('Correos de fechas especiales')
  })

  it('takes images from MAIL_ASSETS_URL when it is set', () => {
    const html = new HtmlTemplateRenderer(
      'http://localhost:5173',
      'https://titantv.com.ec/brand/email/',
    ).render('welcome', SAMPLES.welcome).html
    expect(html).toContain('https://titantv.com.ec/brand/email/lockup-navy@3x.png')
    expect(html).not.toContain('localhost')
  })

  it('serves images from the configured web base url', () => {
    const html = new HtmlTemplateRenderer('https://dev.titantv.com.ec/').render(
      'welcome',
      SAMPLES.welcome,
    ).html
    expect(html).toContain('https://dev.titantv.com.ec/brand/email/bridge-arco-meta@2x.png')
  })
})
