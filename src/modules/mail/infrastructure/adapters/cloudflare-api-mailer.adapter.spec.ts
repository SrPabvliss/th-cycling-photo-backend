import { Logger } from '@nestjs/common'
import { CloudflareApiMailerAdapter } from './cloudflare-api-mailer.adapter'

const originalFetch = global.fetch

describe('CloudflareApiMailerAdapter', () => {
  const baseConfig: Record<string, unknown> = {
    'cloudflare.accountId': 'acc-123',
    'mail.password': 'secret-token',
    'mail.from': 'no-reply@titantv.com.ec',
    'mail.fromName': 'TitanTV',
    'mail.replyTo': 'info@titantv.com.ec',
  }

  const buildAdapter = (overrides: Record<string, unknown> = {}) => {
    const values = { ...baseConfig, ...overrides }
    const configService = {
      getOrThrow: jest.fn((key: string) => values[key]),
      get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    }
    return new CloudflareApiMailerAdapter(configService as never)
  }

  const message = {
    to: 'real@customer.com',
    subject: 'Restablecer tu contraseña',
    html: '<p>secret-reset-link</p>',
    text: 'secret-reset-link',
  }

  const jsonResponse = (body: unknown, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    }) as unknown as Response

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('should post to the Cloudflare send endpoint with the right headers and body', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        result: { message_id: 'id-1', delivered: ['real@customer.com'] },
      }),
    )
    global.fetch = fetchMock as never

    await buildAdapter().send(message)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc-123/email/sending/send')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer secret-token')
    expect(options.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(options.body)
    expect(body).toEqual({
      to: 'real@customer.com',
      from: 'TitanTV <no-reply@titantv.com.ec>',
      subject: 'Restablecer tu contraseña',
      html: '<p>secret-reset-link</p>',
      text: 'secret-reset-link',
      reply_to: 'info@titantv.com.ec',
    })
  })

  it('should throw on a non-2xx response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: false, errors: [{ message: 'bad token' }] }, 401),
      ) as never

    await expect(buildAdapter().send(message)).rejects.toThrow()
  })

  it('should throw on a 200 response with success: false', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: false, errors: [{ message: 'rejected' }] }, 200),
      ) as never

    await expect(buildAdapter().send(message)).rejects.toThrow()
  })

  it('should throw when the response reports a permanent bounce', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        result: { message_id: 'id-1', permanent_bounces: ['real@customer.com'] },
      }),
    ) as never

    await expect(buildAdapter().send(message)).rejects.toThrow()
  })

  it('should not leak the message body in the thrown error or in log output', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: false, errors: [{ message: 'rejected' }] }, 200),
      ) as never

    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    let thrown: unknown
    try {
      await buildAdapter().send(message)
    } catch (error) {
      thrown = error
    }

    const serializedError = JSON.stringify(thrown)
    expect(serializedError).not.toContain('secret-reset-link')

    const loggedText = logSpy.mock.calls.map((call) => call.join(' ')).join(' ')
    expect(loggedText).not.toContain('secret-reset-link')
  })
})
