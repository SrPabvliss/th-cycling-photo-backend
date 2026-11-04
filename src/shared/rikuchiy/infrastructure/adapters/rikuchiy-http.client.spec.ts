import type { ConfigService } from '@nestjs/config'
import type { RikuchiyEmissionPayload } from '../../domain/rikuchiy-emission-payload'
import { RikuchiyHttpClient } from './rikuchiy-http.client'

describe('RikuchiyHttpClient', () => {
  const fetchMock = jest.fn()
  const originalFetch = global.fetch

  const config = (values: Record<string, unknown>) =>
    ({
      get: (key: string, fallback?: unknown) => values[key] ?? fallback,
    }) as ConfigService

  const settings = {
    'rikuchiy.baseUrl': 'http://rikuchiy.local/',
    'rikuchiy.serviceKey': 'rik_x',
    'rikuchiy.timeoutMs': 5000,
  }
  const configured = config(settings)

  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValueOnce({
      ok: status < 300,
      status,
      json: async () => body,
    })

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
    respond(status, {
      error: { code: 'BUSINESS_RULE', message: 'Identificación inválida' },
    })

    const outcome = await new RikuchiyHttpClient(configured).emit(payload)

    expect(outcome).toEqual({
      kind: 'rejected',
      reason: `${status} BUSINESS_RULE: Identificación inválida`,
      message: 'Identificación inválida',
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
    expect(JSON.parse(init.body)).toEqual({
      idType: '05',
      idNumber: '1710034066',
    })
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

  it('answers every follow-up call as unavailable without calling rikuchiy when it is not configured', async () => {
    const client = new RikuchiyHttpClient(config({}))

    expect(await client.getSaleDocuments('order-1')).toBeNull()
    expect(await client.getDocumentFiles('td-1')).toEqual({ kind: 'unavailable' })
    expect(await client.resend('td-1', { id: 'u-1', name: 'Ana' })).toBe('unavailable')
    expect(
      await client.annul('order-1', { emissionId: 'a-1', reason: 'Pedido cancelado' }),
    ).toEqual({
      kind: 'retry',
      reason: 'rikuchiy is not configured',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe('annul', () => {
    const annulment = { emissionId: 'a-1', reason: 'Pedido cancelado' }

    it('posts the annulment to the sale of the row', async () => {
      respond(200, { data: { outcome: 'cancelled' } })

      const result = await new RikuchiyHttpClient(configured).annul('order-1-2', annulment)

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('http://rikuchiy.local/sales/cycling-photo/order-1-2/annulment')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toEqual(annulment)
      expect(result).toEqual({
        kind: 'accepted',
        outcome: 'cancelled',
        creditNoteId: null,
      })
    })

    it('reads the credit note id from a 202 credit_note answer', async () => {
      respond(202, { data: { outcome: 'credit_note', id: 'cn-1' } })

      const result = await new RikuchiyHttpClient(configured).annul('order-1', annulment)

      expect(result).toEqual({
        kind: 'accepted',
        outcome: 'credit_note',
        creditNoteId: 'cn-1',
      })
    })

    it('retries an annulment answered 409', async () => {
      respond(409, {
        error: { code: 'CONFLICT', message: 'no invoice for the sale' },
      })

      const result = await new RikuchiyHttpClient(configured).annul('order-1', annulment)

      expect(result.kind).toBe('retry')
    })

    it.each([400, 422])('rejects an annulment answered %i', async (status) => {
      respond(status, { error: { code: 'BUSINESS_RULE', message: 'x' } })

      const result = await new RikuchiyHttpClient(configured).annul('order-1', annulment)

      expect(result).toEqual({
        kind: 'rejected',
        reason: `${status} BUSINESS_RULE: x`,
        message: 'x',
      })
    })
  })

  describe('reads and resends', () => {
    it('reads the documents of a sale', async () => {
      respond(200, {
        data: [
          {
            id: 'td-1',
            type: 'invoice',
            state: 'authorized',
            number: '001-001-000000123',
            accessKey: '2610202601180272781600110010010000001231234567811',
            issueDate: '2026-10-26',
            authorizedAt: '2026-10-26T13:41:22.000Z',
            attentionReason: null,
            sriMessages: [],
            deliveries: [],
          },
        ],
        meta: { requestId: 'r' },
      })

      const documents = await new RikuchiyHttpClient(configured).getSaleDocuments('order-1')

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('http://rikuchiy.local/sales/cycling-photo/order-1/tax-documents')
      expect(init.method).toBe('GET')
      expect(init.headers.Authorization).toBe('Bearer rik_x')
      expect(documents).toEqual([
        {
          id: 'td-1',
          externalRef: 'order-1',
          type: 'invoice',
          state: 'authorized',
          number: '001-001-000000123',
          accessKey: '2610202601180272781600110010010000001231234567811',
          issueDate: '2026-10-26',
          authorizedAt: new Date('2026-10-26T13:41:22.000Z'),
          sriMessages: [],
          deliveries: [],
          syncedAt: null,
        },
      ])
    })

    it.each([
      500, 403,
    ])('returns null when rikuchiy does not answer the sale read (%i)', async (status) => {
      respond(status, { error: { code: 'X', message: 'x' } })

      expect(await new RikuchiyHttpClient(configured).getSaleDocuments('order-1')).toBeNull()
    })

    it('returns null when rikuchiy times out on the sale read', async () => {
      fetchMock.mockRejectedValueOnce(new Error('timeout'))

      expect(await new RikuchiyHttpClient(configured).getSaleDocuments('order-1')).toBeNull()
    })

    it('reads the signed files of a document', async () => {
      respond(200, {
        data: {
          xml: { url: 'https://b2/x.xml', expiresAt: '2026-10-26T13:50:00.000Z' },
          pdf: { url: 'https://b2/x.pdf', expiresAt: '2026-10-26T13:50:00.000Z' },
        },
      })

      const result = await new RikuchiyHttpClient(configured).getDocumentFiles('td-1')

      expect(fetchMock.mock.calls[0][0]).toBe('http://rikuchiy.local/tax-documents/td-1/files')
      expect(result).toEqual({
        kind: 'files',
        xml: { url: 'https://b2/x.xml', expiresAt: '2026-10-26T13:50:00.000Z' },
        pdf: { url: 'https://b2/x.pdf', expiresAt: '2026-10-26T13:50:00.000Z' },
      })
    })

    it('maps 409 on files to not_stored', async () => {
      respond(409, { error: { code: 'CONFLICT', message: 'x' } })

      expect(await new RikuchiyHttpClient(configured).getDocumentFiles('td-1')).toEqual({
        kind: 'not_stored',
      })
    })

    it.each([404, 500])('maps %i on files to unavailable', async (status) => {
      respond(status, { error: { code: 'X', message: 'x' } })

      expect(await new RikuchiyHttpClient(configured).getDocumentFiles('td-1')).toEqual({
        kind: 'unavailable',
      })
    })

    it('accepts a resend as an operator', async () => {
      respond(202, { data: {} })

      const result = await new RikuchiyHttpClient(configured).resend('td-1', {
        id: 'admin-7',
        name: 'Franklin',
      })

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('http://rikuchiy.local/tax-documents/td-1/resends')
      expect(JSON.parse(init.body)).toEqual({
        requestedBy: { kind: 'operator', id: 'admin-7', name: 'Franklin' },
        email: null,
      })
      expect(result).toBe('accepted')
    })

    it('maps 409 on a resend to not_resendable', async () => {
      respond(409, { error: { code: 'CONFLICT', message: 'x' } })

      expect(await new RikuchiyHttpClient(configured).resend('td-1', { id: 'a', name: 'b' })).toBe(
        'not_resendable',
      )
    })

    it('maps any other resend failure to unavailable', async () => {
      respond(500, { error: { code: 'X', message: 'x' } })

      expect(await new RikuchiyHttpClient(configured).resend('td-1', { id: 'a', name: 'b' })).toBe(
        'unavailable',
      )
    })
  })
})
