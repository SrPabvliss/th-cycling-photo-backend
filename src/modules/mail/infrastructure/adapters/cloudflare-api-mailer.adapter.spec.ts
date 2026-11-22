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

  let enqueue: jest.Mock

  beforeEach(() => {
    enqueue = jest.fn().mockResolvedValue(undefined)
  })

  const buildAdapter = (overrides: Record<string, unknown> = {}) => {
    const values = { ...baseConfig, ...overrides }
    const configService = {
      getOrThrow: jest.fn((key: string) => values[key]),
      get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    }
    return new CloudflareApiMailerAdapter(configService as never, { enqueue } as never)
  }

  const recordedItemKeys = () =>
    enqueue.mock.calls.flatMap(([entries]: [{ itemKey: string }[]]) =>
      entries.map((entry) => entry.itemKey),
    )

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

  it('should forward custom headers such as List-Unsubscribe', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        result: { message_id: 'id-2', delivered: ['real@customer.com'] },
      }),
    )
    global.fetch = fetchMock as never

    await buildAdapter().send({
      ...message,
      headers: {
        'List-Unsubscribe': '<https://api.titantv.com.ec/api/v1/mail/unsubscribe?token=t>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.headers).toEqual({
      'List-Unsubscribe': '<https://api.titantv.com.ec/api/v1/mail/unsubscribe?token=t>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
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

  it("logs and carries Cloudflare's error code when it refuses a suppressed recipient", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          errors: [{ code: 10205, message: 'email.sending.error.email.recipient_suppressed' }],
          result: null,
        },
        400,
      ),
    ) as never
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    let thrown: unknown
    try {
      await buildAdapter().send(message)
    } catch (error) {
      thrown = error
    }

    const loggedText = logSpy.mock.calls.map((call) => call.join(' ')).join(' ')
    expect(loggedText).toContain('400')
    expect(loggedText).toContain('10205 email.sending.error.email.recipient_suppressed')
    expect(JSON.stringify(thrown)).toContain('10205 email.sending.error.email.recipient_suppressed')
  })

  it('logs a short raw body when the error response is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: jest.fn().mockResolvedValue(`<html>${'x'.repeat(2000)}</html>`),
    }) as never
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    await expect(buildAdapter().send(message)).rejects.toThrow()

    const loggedText = logSpy.mock.calls.map((call) => call.join(' ')).join(' ')
    expect(loggedText).toContain('502')
    expect(loggedText).toContain('<html>')
    expect(loggedText.length).toBeLessThan(1000)
  })

  it('logs the message id and the recipient outcome when Cloudflare accepts the message', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        result: { message_id: '<abc@titantv.com.ec>', queued: ['real@customer.com'] },
      }),
    ) as never
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

    await buildAdapter().send(message)

    const loggedText = logSpy.mock.calls.map((call) => call.join(' ')).join(' ')
    expect(loggedText).toContain('<abc@titantv.com.ec>')
    expect(loggedText).toContain('real@customer.com (queued)')
  })

  it('warns when Cloudflare accepts the request but suppresses the recipient', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        result: {
          message_id: '<abc@titantv.com.ec>',
          suppressed_recipients: ['real@customer.com'],
        },
      }),
    ) as never
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    await buildAdapter().send(message)

    const warnedText = warnSpy.mock.calls.map((call) => call.join(' ')).join(' ')
    expect(warnedText).toContain('suppressed real@customer.com')
  })

  it('records one email send when Cloudflare accepts the message', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        result: { message_id: '<abc@titantv.com.ec>', queued: ['real@customer.com'] },
      }),
    ) as never

    await buildAdapter().send(message)

    expect(recordedItemKeys()).toEqual(['email:<abc@titantv.com.ec>'])
  })

  it('records the send and still throws when the recipient bounced permanently', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        result: { message_id: '<abc@titantv.com.ec>', permanent_bounces: ['real@customer.com'] },
      }),
    ) as never

    await expect(buildAdapter().send(message)).rejects.toThrow()
    expect(recordedItemKeys()).toEqual(['email:<abc@titantv.com.ec>'])
  })

  it('records nothing for a suppressed recipient', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        result: {
          message_id: '<abc@titantv.com.ec>',
          suppressed_recipients: ['real@customer.com'],
        },
      }),
    ) as never

    await buildAdapter().send(message)

    expect(enqueue).not.toHaveBeenCalled()
  })

  it('records nothing when Cloudflare answers success false', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: false, errors: [{ message: 'rejected' }] }, 200),
      ) as never

    await expect(buildAdapter().send(message)).rejects.toThrow()
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('records nothing when the request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as never

    await expect(buildAdapter().send(message)).rejects.toThrow()
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('delivers without throwing when the outbox write fails', async () => {
    enqueue.mockRejectedValue(new Error('database down'))
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        result: { message_id: '<abc@titantv.com.ec>', delivered: ['real@customer.com'] },
      }),
    ) as never

    await expect(buildAdapter().send(message)).resolves.toBeUndefined()
  })
})
