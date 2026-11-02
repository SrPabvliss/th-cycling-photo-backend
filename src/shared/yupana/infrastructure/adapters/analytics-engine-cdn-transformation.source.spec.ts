import type { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'
import { AnalyticsEngineCdnTransformationSource } from './analytics-engine-cdn-transformation.source'

describe('AnalyticsEngineCdnTransformationSource', () => {
  const fetchMock = jest.fn()
  const originalFetch = global.fetch

  const configured = {
    get: (key: string, fallback?: unknown) =>
      ({
        'cloudflare.accountId': 'account',
        'cloudflare.analyticsToken': 'token',
        'cloudflare.transformationsDataset': 'cdn_transformations_dev',
      })[key] ?? fallback,
  } as ConfigService

  const respond = (body: unknown) =>
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body })

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('reads the distinct combinations of a UTC day', async () => {
    respond({
      data: [{ key: 'k1', kind: 'gallery', slug: 's1' }],
      rows: 1,
      rows_before_limit_at_least: 0,
    })

    const points = await new AnalyticsEngineCdnTransformationSource(configured).readDay(
      '2026-11-03',
    )

    expect(points).toEqual([{ combinationKey: 'k1', kind: 'gallery', slug: 's1' }])
    const sql = fetchMock.mock.calls[0][1].body as string
    expect(sql).toContain("toDateTime('2026-11-03 00:00:00')")
    expect(sql).toContain("toDateTime('2026-11-04 00:00:00')")
  })

  it('accepts a grouped day whose raw points outnumber its combinations', async () => {
    const data = Array.from({ length: 8 }, (_, i) => ({
      key: `k${i}`,
      kind: 'gallery',
      slug: `s${i}`,
    }))
    respond({ data, rows: 8, rows_before_limit_at_least: 10 })

    const points = await new AnalyticsEngineCdnTransformationSource(configured).readDay(
      '2026-11-02',
    )

    expect(points).toHaveLength(8)
  })

  it('finds the first day from an aggregate answer over many points', async () => {
    respond({ data: [{ first: '2026-11-02 17:07:09' }], rows: 1, rows_before_limit_at_least: 8 })

    const first = await new AnalyticsEngineCdnTransformationSource(configured).findFirstDay()

    expect(first).toBe('2026-11-02')
  })

  it('refuses a day that reaches the row limit so it stays pending', async () => {
    const limit = AnalyticsEngineCdnTransformationSource.ROW_LIMIT
    const data = Array.from({ length: limit + 1 }, (_, i) => ({
      key: `k${i}`,
      kind: 'gallery',
      slug: 's',
    }))
    respond({ data, rows: limit + 1, rows_before_limit_at_least: limit + 1 })

    const error = await new AnalyticsEngineCdnTransformationSource(configured)
      .readDay('2026-11-03')
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('EXTERNAL_SERVICE')
    expect(fetchMock.mock.calls[0][1].body as string).toContain(`LIMIT ${limit + 1}`)
  })
})
