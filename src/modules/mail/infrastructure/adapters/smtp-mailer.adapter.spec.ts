import { SmtpMailerAdapter } from './smtp-mailer.adapter'

const sendMail = jest.fn().mockResolvedValue(undefined)

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail })),
}))

describe('SmtpMailerAdapter', () => {
  const baseConfig: Record<string, unknown> = {
    'mail.host': 'smtp.mx.cloudflare.net',
    'mail.port': 465,
    'mail.user': 'api_token',
    'mail.password': 'secret-token',
    'mail.from': 'no-reply@titantv.com.ec',
    'mail.fromName': 'TitanTV',
    'mail.replyTo': 'info@titantv.com.ec',
    'mail.redirectTo': '',
  }

  const buildAdapter = (overrides: Record<string, unknown> = {}) => {
    const values = { ...baseConfig, ...overrides }
    const configService = {
      getOrThrow: jest.fn((key: string) => values[key]),
      get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    }
    return new SmtpMailerAdapter(configService as never)
  }

  beforeEach(() => {
    sendMail.mockClear()
  })

  const message = {
    to: 'real@customer.com',
    subject: 'Restablecer tu contraseña',
    html: '<p>hola</p>',
    text: 'hola',
  }

  it('should send to the real recipient when no redirect is configured', async () => {
    await buildAdapter().send(message)

    expect(sendMail).toHaveBeenCalledTimes(1)
    const sent = sendMail.mock.calls[0][0]
    expect(sent.to).toBe('real@customer.com')
    expect(sent.subject).toBe('Restablecer tu contraseña')
    expect(sent.from).toBe('TitanTV <no-reply@titantv.com.ec>')
    expect(sent.replyTo).toBe('info@titantv.com.ec')
    expect(sent.headers['X-Original-To']).toBeUndefined()
  })

  it('should divert every recipient when a redirect is configured', async () => {
    await buildAdapter({ 'mail.redirectTo': 'dev@personal.com' }).send(message)

    const sent = sendMail.mock.calls[0][0]
    expect(sent.to).toBe('dev@personal.com')
    expect(sent.subject).toBe('[DEV -> real@customer.com] Restablecer tu contraseña')
    expect(sent.headers['X-Original-To']).toBe('real@customer.com')
    expect(sent.html).toContain('real@customer.com')
    expect(sent.text).toContain('real@customer.com')
  })
})
