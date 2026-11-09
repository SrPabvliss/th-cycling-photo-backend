import type { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'
import { YupanaHttpClient } from './yupana-http.client'

describe('YupanaHttpClient', () => {
  const fetchMock = jest.fn()
  const originalFetch = global.fetch

  const config = (values: Record<string, unknown>) =>
    ({ get: (key: string, fallback?: unknown) => values[key] ?? fallback }) as ConfigService

  const configured = config({
    'yupana.baseUrl': 'http://yupana.local',
    'yupana.producerKey': 'producer-key',
    'yupana.serviceKey': 'service-key',
    'yupana.timeoutMs': 5000,
  })

  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValueOnce({ ok: status < 300, status, json: async () => body })

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('is configured only with a base url and a producer key', () => {
    expect(new YupanaHttpClient(configured).isConfigured()).toBe(true)
    expect(new YupanaHttpClient(config({ 'yupana.baseUrl': 'http://x' })).isConfigured()).toBe(
      false,
    )
  })

  it('sends reports with the producer key and keys each result by report id', async () => {
    respond(200, {
      data: [
        { sourceReportId: 'r1', outcome: 'accepted', reason: null, rejectedReportId: null },
        {
          sourceReportId: 'r2',
          outcome: 'rejected',
          reason: 'payload_invalid',
          rejectedReportId: 'x',
        },
      ],
    })

    const results = await new YupanaHttpClient(configured).sendReports([
      { report_id: 'r1' },
      { report_id: 'r2' },
    ])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://yupana.local/reports')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer producer-key')
    expect(JSON.parse(init.body)).toEqual({ reports: [{ report_id: 'r1' }, { report_id: 'r2' }] })
    expect(results).toEqual([
      { key: 'r1', outcome: 'accepted', reason: null },
      { key: 'r2', outcome: 'rejected', reason: 'payload_invalid' },
    ])
  })

  it('keys each declaration result by photo and declaration instant', async () => {
    respond(200, {
      data: [
        {
          photoId: 'p1',
          declaredAt: '2026-11-01T12:00:05.000Z',
          outcome: 'duplicate',
          reason: null,
        },
      ],
    })

    const results = await new YupanaHttpClient(configured).sendDeclarations([{ photo_id: 'p1' }])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://yupana.local/photos/declarations')
    expect(JSON.parse(init.body)).toEqual({ declarations: [{ photo_id: 'p1' }] })
    expect(results).toEqual([
      { key: 'p1@2026-11-01T12:00:05.000Z', outcome: 'duplicate', reason: null },
    ])
  })

  it('fails as an external service on a non-2xx answer', async () => {
    respond(503, { error: { code: 'INTERNAL' } })

    await expect(new YupanaHttpClient(configured).sendReports([{}])).rejects.toBeInstanceOf(
      AppException,
    )
  })

  it('fails as an external service when yupana does not answer', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))

    await expect(new YupanaHttpClient(configured).sendReports([{}])).rejects.toMatchObject({
      context: expect.objectContaining({ service: 'yupana' }),
    })
  })

  it('reads with the service key and passes only the defined query values', async () => {
    respond(200, { data: { events: [] } })

    const data = await new YupanaHttpClient(configured).read('/costs/events', {
      month: '2026-11',
      environment: 'dev',
      sort: undefined,
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://yupana.local/costs/events?month=2026-11&environment=dev')
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer service-key')
    expect(data).toEqual({ events: [] })
  })

  it('answers not found when yupana has nothing for what was read', async () => {
    respond(404, { error: { code: 'NOT_FOUND', message: 'Evento sin costos' } })

    await expect(
      new YupanaHttpClient(configured).read('/costs/events/ev-1', {}),
    ).rejects.toMatchObject({ httpStatus: 404, code: 'NOT_FOUND' })
  })

  it('answers an invalid query when yupana refuses the read parameters', async () => {
    respond(400, { error: { code: 'VALIDATION_FAILED', fields: { month: 'x' } } })

    await expect(
      new YupanaHttpClient(configured).read('/costs/events', { month: '2026-13' }),
    ).rejects.toMatchObject({ messageKey: 'cost.invalid_query' })
  })

  it('still fails as an external service when yupana refuses the key on a read', async () => {
    respond(401, { error: { code: 'UNAUTHORIZED' } })

    await expect(new YupanaHttpClient(configured).read('/health', {})).rejects.toMatchObject({
      context: expect.objectContaining({ service: 'yupana' }),
    })
  })
})
