import type { PrismaService } from '@shared/infrastructure'
import { buildEventAggregates } from './event-aggregates'

const EVENT_A = '11111111-1111-1111-1111-111111111111'
const EVENT_B = '22222222-2222-2222-2222-222222222222'

type RawCall = { sql: string }

function makePrisma(photoRows: unknown[], orderRows: unknown[]) {
  const calls: RawCall[] = []
  const $queryRaw = jest.fn((strings: TemplateStringsArray) => {
    const sql = strings.join('?')
    calls.push({ sql })
    return Promise.resolve(sql.includes('FROM photos') ? photoRows : orderRows)
  })
  return { prisma: { $queryRaw } as unknown as Pick<PrismaService, '$queryRaw'>, calls, $queryRaw }
}

describe('buildEventAggregates', () => {
  it('issues no query at all for an empty id list', async () => {
    const { prisma, $queryRaw } = makePrisma([], [])
    const result = await buildEventAggregates(prisma, [])

    expect($queryRaw).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })

  it('returns an entry for every requested id, zeroed when the event has nothing', async () => {
    const { prisma } = makePrisma([], [])
    const result = await buildEventAggregates(prisma, [EVENT_A, EVENT_B])

    expect([...result.keys()].sort()).toEqual([EVENT_A, EVENT_B].sort())
    expect(result.get(EVENT_A)).toEqual({
      reviewedCount: 0,
      categorizedCount: 0,
      revenue: '0.00',
      paidCount: 0,
      deliveredCount: 0,
      giftedCount: 0,
      unpaidCount: 0,
      cancelledCount: 0,
      soldPhotoCount: 0,
      lastUploadAt: null,
    })
  })

  it('maps photo and order aggregates onto the right event', async () => {
    const uploadedAt = new Date('2026-08-21T10:00:00Z')
    const { prisma } = makePrisma(
      [
        {
          event_id: EVENT_A,
          reviewed_count: 2410,
          categorized_count: 2560,
          last_upload_at: uploadedAt,
        },
      ],
      [
        {
          event_id: EVENT_A,
          revenue: '3184.5',
          paid_count: 61,
          delivered_count: 33,
          gifted_count: 7,
          unpaid_count: 5,
          cancelled_count: 2,
          sold_photo_count: 512,
        },
      ],
    )

    const result = await buildEventAggregates(prisma, [EVENT_A, EVENT_B])

    expect(result.get(EVENT_A)).toEqual({
      reviewedCount: 2410,
      categorizedCount: 2560,
      revenue: '3184.50',
      paidCount: 61,
      deliveredCount: 33,
      giftedCount: 7,
      unpaidCount: 5,
      cancelledCount: 2,
      soldPhotoCount: 512,
      lastUploadAt: uploadedAt,
    })
    expect(result.get(EVENT_B)?.revenue).toBe('0.00')
  })

  it('aggregates in the database rather than loading rows to count them', async () => {
    const { prisma, calls } = makePrisma([], [])
    await buildEventAggregates(prisma, [EVENT_A])

    const photos = calls.find((c) => c.sql.includes('FROM photos'))?.sql ?? ''
    expect(photos).toContain('COUNT(*) FILTER (WHERE p.reviewed_at IS NOT NULL)')
    expect(photos).toContain('COUNT(*) FILTER (WHERE p.photo_category_id IS NOT NULL)')
    expect(photos).toContain('MAX(p.uploaded_at)')
    expect(photos).toContain('GROUP BY p.event_id')
  })

  it('sums revenue over paid and delivered only, and never over draft', async () => {
    const { prisma, calls } = makePrisma([], [])
    await buildEventAggregates(prisma, [EVENT_A])

    const orders = calls.find((c) => c.sql.includes('FROM orders'))?.sql ?? ''
    expect(orders).toContain("SUM(o.subtotal) FILTER (WHERE o.status IN ('paid', 'delivered'))")
    expect(orders).toContain("o.status <> 'draft'")
    expect(orders).not.toContain(
      "SUM(o.subtotal) FILTER (WHERE o.status IN ('paid', 'delivered', 'gifted')",
    )
  })

  it('counts the unpaid pair as one figure', async () => {
    const { prisma, calls } = makePrisma([], [])
    await buildEventAggregates(prisma, [EVENT_A])

    const orders = calls.find((c) => c.sql.includes('FROM orders'))?.sql ?? ''
    expect(orders).toContain("COUNT(*) FILTER (WHERE o.status IN ('pending', 'payment_info_sent'))")
  })

  it('defaults soldPhotoCount to zero for an event with no orders', async () => {
    const { prisma } = makePrisma([], [])
    const result = await buildEventAggregates(prisma, [EVENT_A])

    expect(result.get(EVENT_A)?.soldPhotoCount).toBe(0)
  })

  it('reads soldPhotoCount from the order aggregate row', async () => {
    const { prisma } = makePrisma(
      [],
      [
        {
          event_id: EVENT_A,
          revenue: '196.00',
          paid_count: 20,
          delivered_count: 10,
          gifted_count: 0,
          unpaid_count: 6,
          cancelled_count: 0,
          sold_photo_count: 72,
        },
      ],
    )
    const result = await buildEventAggregates(prisma, [EVENT_A])

    expect(result.get(EVENT_A)?.soldPhotoCount).toBe(72)
  })

  it('computes sold_photo_count via a subquery correlated on the outer event, never by joining order_items into the outer FROM', async () => {
    const { prisma, calls } = makePrisma([], [])
    await buildEventAggregates(prisma, [EVENT_A])

    const orderSql = calls.map((c) => c.sql).find((sql) => sql.includes('FROM orders')) ?? ''

    expect(orderSql).toMatch(/SELECT\s+COUNT\(\*\)::int\s+FROM order_items oi/)
    expect(orderSql).toContain('o2.event_id = o.event_id')

    const outerFromIndex = orderSql.indexOf('FROM orders o')
    expect(outerFromIndex).toBeGreaterThan(-1)
    const outerClause = orderSql.slice(outerFromIndex)
    expect(outerClause).not.toContain('order_items')
    expect(outerClause).not.toMatch(/JOIN/i)
  })
})
