import type { ConfigService } from '@nestjs/config'
import type { RikuchiyEmissionPayload } from '../../domain/rikuchiy-emission-payload'
import { RikuchiyHttpClient } from './rikuchiy-http.client'

describe('RikuchiyHttpClient', () => {
  const fetchMock = jest.fn()
  const originalFetch = global.fetch

  const config = (values: Record<string, unknown>) =>
    ({ get: (key: string, fallback?: unknown) => values[key] ?? fallback }) as ConfigService

  const settings = {
    'rikuchiy.baseUrl': 'http://rikuchiy.local/',
    'rikuchiy.serviceKey': 'rik_x',
    'rikuchiy.timeoutMs': 5000,
  }
  const configured = config(settings)

  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValueOnce({ ok: status < 300, status, json: async () => body })

  const payload: RikuchiyEmissionPayload = {
    emissionId: 'e-1',
    sale: { app: 'cycling-photo', externalRef: 'order-1' },
    buyer: {
      idType: '05',
      idNumber: '1710034065',
      legalName: 'Juan Pérez',
      address: null,
      email: 'juan@correo.com',
      phone: null,
    },
    lines: [
      {
        code: 'FOTO',
        description: 'Fotografía digital',
        quantity: 1,
        grossPrice: '3.00',
        additionalDetails: [{ name: 'Archivo', value: 'DH-001' }],
      },
    ],
    additionalInfo: [{ name: 'Pedido', value: 'order-1' }],
    total: '3.00',
    paymentMethod: '20',
    consent: { givenAt: '2026-11-03T15:00:00.000Z', ip: '190.1.1.1' },
  }

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('is configured only with a base url and a service key', () => {
    expect(new RikuchiyHttpClient(configured).isConfigured()).toBe(true)
    expect(new RikuchiyHttpClient(config({ 'rikuchiy.baseUrl': 'http://x' })).isConfigured()).toBe(
      false,
    )
    expect(new RikuchiyHttpClient(config({ 'rikuchiy.serviceKey': 'rik_x' })).isConfigured()).toBe(
      false,
    )
  })

  it('posts an emission with the service key and reports the tax document id', async () => {
    respond(202, { data: { id: 'td-1' }, meta: { requestId: 'r' } })

    const outcome = await new RikuchiyHttpClient(configured).emit(payload)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://rikuchiy.local/emissions')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer rik_x')
    expect(JSON.parse(init.body)).toEqual(payload)
    expect(outcome).toEqual({ kind: 'accepted', taxDocumentId: 'td-1' })
  })

  it.each([400, 409, 422])('rejects the emission when rikuchiy answers %i', async (status) => {
    respond(status, { error: { code: 'BUSINESS_RULE', message: 'Identificación inválida' } })

    const outcome = await new RikuchiyHttpClient(configured).emit(payload)

    expect(outcome).toEqual({
      kind: 'rejected',
      reason: `${status} BUSINESS_RULE: Identificación inválida`,
    })
  })

  it.each([401, 403, 500])('retries the emission when rikuchiy answers %i', async (status) => {
    respond(status, { error: { code: 'UNAUTHORIZED', message: 'x' } })

    const outcome = await new RikuchiyHttpClient(configured).emit(payload)

    expect(outcome.kind).toBe('retry')
  })

  it('retries the emission when rikuchiy does not answer', async () => {
    fetchMock.mockRejectedValueOnce(new Error('The operation was aborted due to timeout'))

    const outcome = await new RikuchiyHttpClient(configured).emit(payload)

    expect(outcome).toEqual({
      kind: 'retry',
      reason: 'The operation was aborted due to timeout',
    })
  })

  it('sends the invoice to the dev redirect without touching the payload', async () => {
    respond(202, { data: { id: 'td-1' } })
    const client = new RikuchiyHttpClient(
      config({ ...settings, 'mail.redirectTo': 'pablo@dev.ec' }),
    )

    await client.emit(payload)

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body).buyer.email).toBe('pablo@dev.ec')
    expect(payload.buyer.email).toBe('juan@correo.com')
  })

  it('validates an identification with rikuchiy', async () => {
    respond(200, { data: { valid: false, reason: 'invalid_check_digit' } })

    const check = await new RikuchiyHttpClient(configured).validateIdentification(
      '05',
      '1710034066',
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://rikuchiy.local/identifications/validation')
    expect(JSON.parse(init.body)).toEqual({ idType: '05', idNumber: '1710034066' })
    expect(check).toEqual({ valid: false, reason: 'invalid_check_digit' })
  })

  it('gives no verdict when rikuchiy fails to validate', async () => {
    respond(500, null)
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const client = new RikuchiyHttpClient(configured)

    expect(await client.validateIdentification('05', '1710034065')).toBeNull()
    expect(await client.validateIdentification('05', '1710034065')).toBeNull()
  })

  it('gives no verdict without calling rikuchiy when it is not configured', async () => {
    const check = await new RikuchiyHttpClient(config({})).validateIdentification(
      '05',
      '1710034065',
    )

    expect(check).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
