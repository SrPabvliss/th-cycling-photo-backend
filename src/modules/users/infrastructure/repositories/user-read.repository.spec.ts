import { Pagination } from '@shared/application'
import { UserReadRepository } from './user-read.repository'

function buildRepository() {
  const findMany = jest.fn().mockResolvedValue([])
  const findFirst = jest.fn().mockResolvedValue(null)
  const count = jest.fn().mockResolvedValue(0)
  const queryRaw = jest.fn().mockResolvedValue([])
  const orderFindMany = jest.fn().mockResolvedValue([])
  const consentFindMany = jest.fn().mockResolvedValue([])

  const prisma = {
    user: { findMany, findFirst, count },
    order: { findMany: orderFindMany },
    userConsent: { findMany: consentFindMany },
    $queryRaw: queryRaw,
  }

  return {
    repository: new UserReadRepository(prisma as never),
    findMany,
    findFirst,
    count,
    queryRaw,
    orderFindMany,
    consentFindMany,
  }
}

const buyerRowFixture = {
  id: 'buyer-1',
  first_name: 'Ana',
  last_name: 'Ruiz',
  email: 'ana@example.com',
  email_verified_at: null,
  is_active: true,
  last_login_at: null,
  created_at: new Date('2026-01-01'),
  phones: [],
  customer_profile: null,
}

function pageQuery(queryRaw: jest.Mock) {
  return queryRaw.mock.calls[0][0] as { sql: string; values: unknown[] }
}

describe('UserReadRepository getBuyersList filters', () => {
  it('produces a NOT EXISTS predicate on orders for the "never" purchase filter', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])

    await repository.getBuyersList(new Pagination(1, 20), { purchase: 'never' })

    const { sql } = pageQuery(queryRaw)
    expect(sql).toContain(
      "NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status != 'draft')",
    )
  })

  it('produces an EXISTS predicate on orders for the "bought" purchase filter', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])

    await repository.getBuyersList(new Pagination(1, 20), { purchase: 'bought' })

    const { sql } = pageQuery(queryRaw)
    expect(sql).toContain(
      "EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status != 'draft')",
    )
    expect(sql).not.toContain('NOT EXISTS')
  })

  it('resolves "recurrent" as a HAVING-style predicate on the order aggregate, not a precomputed id list', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([{ id: 'user-1', total_count: 1n }])

    await repository.getBuyersList(new Pagination(1, 20), { purchase: 'recurrent' })

    expect(queryRaw).toHaveBeenCalledTimes(1)
    const { sql } = pageQuery(queryRaw)
    expect(sql).toContain('WHERE a.order_count >= 2')
    expect(sql).not.toMatch(/user_id\s+FROM\s+orders\s+WHERE\s+status\s*!=\s*'draft'\s+GROUP BY/)
  })

  it('never runs the unbounded "recurrent" scan (no whole-table GROUP BY on orders)', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])

    await repository.getBuyersList(new Pagination(1, 20), { purchase: 'recurrent' })

    const calledQueries = queryRaw.mock.calls.map((call) => (call[0] as { sql: string }).sql)
    calledQueries.forEach((sql) => {
      expect(sql).not.toMatch(/^\s*SELECT user_id FROM orders WHERE status/)
    })
  })

  it('turns an age range into a bound birth_date predicate on the customer profile', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])
    const now = new Date('2026-08-23T00:00:00.000Z')
    jest.useFakeTimers().setSystemTime(now.getTime())

    await repository.getBuyersList(new Pagination(1, 20), { ageFrom: 18, ageTo: 40 })

    const { sql, values } = pageQuery(queryRaw)
    expect(sql).toContain('cp.birth_date <=')
    expect(sql).toContain('cp.birth_date >=')
    expect(values).toContainEqual(new Date('2008-08-23T00:00:00.000Z'))
    expect(values).toContainEqual(new Date('1985-08-23T00:00:00.000Z'))

    jest.useRealTimers()
  })

  it('keeps a draft out of the buyer figures, via the aggregate builder', async () => {
    const { repository, queryRaw, orderFindMany } = buildRepository()
    queryRaw.mockResolvedValueOnce([{ id: 'user-1', total_count: 1n }])

    await repository.getBuyersList(new Pagination(1, 20), {})

    const { where: orderWhere } = orderFindMany.mock.calls[0][0]
    expect(JSON.stringify(orderWhere)).toContain('draft')
  })

  it('sorts "orders" by a draft-excluded count', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])

    await repository.getBuyersList(new Pagination(1, 20), { sort: 'orders' })

    const { sql } = pageQuery(queryRaw)
    expect(sql).toContain("FILTER (WHERE o.status != 'draft') AS order_count")
    expect(sql).toContain('ORDER BY a.order_count DESC NULLS LAST, c.id ASC')
  })

  it('produces an EXISTS predicate on the primary WhatsApp phone', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])

    await repository.getBuyersList(new Pagination(1, 20), { hasWhatsapp: true })

    const { sql } = pageQuery(queryRaw)
    expect(sql).toContain(
      'EXISTS (SELECT 1 FROM user_phones p WHERE p.user_id = u.id AND p.is_primary AND p.is_whatsapp)',
    )
  })

  it('scopes the "no WhatsApp" side of the filter to the primary phone too', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])

    await repository.getBuyersList(new Pagination(1, 20), { hasWhatsapp: false })

    const { sql } = pageQuery(queryRaw)
    expect(sql).toContain(
      'NOT EXISTS (SELECT 1 FROM user_phones p WHERE p.user_id = u.id AND p.is_primary AND p.is_whatsapp)',
    )
  })

  it.each([
    'orders',
    'spent',
    'last_purchase',
  ] as const)('breaks ties on c.id for the "%s" raw sort, so tied rows never shift between page requests', async (sort) => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])

    await repository.getBuyersList(new Pagination(1, 20), { sort })

    const { sql } = pageQuery(queryRaw)
    expect(sql).toContain('DESC NULLS LAST, c.id ASC')
  })

  it('breaks ties on id for the default "recent" sort too, so tied rows never shift between page requests', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])

    await repository.getBuyersList(new Pagination(1, 20), {})

    const { sql } = pageQuery(queryRaw)
    expect(sql).toContain('ORDER BY c.created_at DESC NULLS LAST, c.id ASC')
  })

  it('escapes LIKE metacharacters in the search term so a literal "%" is not treated as a wildcard', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])

    await repository.getBuyersList(new Pagination(1, 20), { search: '50%_off' })

    const { values } = pageQuery(queryRaw)
    expect(values).toContain('%50\\%\\_off%')
  })

  it('falls back to a second, still-bounded count query when the requested page is past the last row', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([])
    queryRaw.mockResolvedValueOnce([{ count: 7n }])

    const result = await repository.getBuyersList(new Pagination(5, 20), {})

    expect(queryRaw).toHaveBeenCalledTimes(2)
    expect(result.total).toBe(7)
    const fallback = queryRaw.mock.calls[1][0] as { sql: string }
    expect(fallback.sql).not.toMatch(/uuid\[\]/)
  })
})

function statsRow(overrides: {
  total_buyers?: bigint
  bought_count?: bigint
  recurrent_count?: bigint
  new_last_30_days?: bigint
  total_spent?: string
  total_money_order_count?: bigint
}) {
  return {
    total_buyers: 0n,
    bought_count: 0n,
    recurrent_count: 0n,
    new_last_30_days: 0n,
    total_spent: '0',
    total_money_order_count: 0n,
    ...overrides,
  }
}

describe('UserReadRepository getBuyersStats', () => {
  it('returns all zeroes, boughtPercent 0 and averageTicket "0.00" when there are no buyers at all', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([statsRow({})])

    const stats = await repository.getBuyersStats({})

    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(stats).toEqual({
      totalBuyers: 0,
      boughtCount: 0,
      boughtPercent: 0,
      recurrentCount: 0,
      newLast30Days: 0,
      averageTicket: '0.00',
      tabs: { all: 0, bought: 0, never: 0, recurrent: 0 },
    })
  })

  it('computes every tile and tab from a single round trip', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([
      statsRow({
        total_buyers: 3n,
        bought_count: 2n,
        recurrent_count: 1n,
        total_spent: '35.00',
        total_money_order_count: 2n,
      }),
    ])

    const stats = await repository.getBuyersStats({})

    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(stats.tabs.all).toBe(3)
    expect(stats.tabs.bought + stats.tabs.never).toBe(stats.tabs.all)
    expect(stats.tabs.bought).toBe(2)
    expect(stats.tabs.never).toBe(1)
    expect(stats.tabs.recurrent).toBe(1)
    expect(stats.tabs.recurrent).toBeLessThanOrEqual(stats.tabs.bought)
  })

  it('never lets a gifted-only order count as money in averageTicket', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([
      statsRow({
        total_buyers: 1n,
        bought_count: 1n,
        total_spent: '0',
        total_money_order_count: 0n,
      }),
    ])

    const stats = await repository.getBuyersStats({})

    expect(stats.boughtCount).toBe(1)
    expect(stats.averageTicket).toBe('0.00')
  })

  it('divides total spend by the number of paid and delivered orders, not the number of buyers who bought — matching getBuyerDetail', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([
      statsRow({
        total_buyers: 2n,
        bought_count: 2n,
        total_spent: '40.00',
        total_money_order_count: 3n,
      }),
    ])

    const stats = await repository.getBuyersStats({})

    expect(stats.averageTicket).toBe('13.33')
    expect(stats.boughtPercent).toBe(100)
  })

  it('counts newLast30Days from the SQL predicate, not a JS date filter', async () => {
    const { repository, queryRaw } = buildRepository()
    const now = new Date('2026-08-23T00:00:00.000Z')
    jest.useFakeTimers().setSystemTime(now.getTime())
    queryRaw.mockResolvedValueOnce([statsRow({ total_buyers: 2n, new_last_30_days: 1n })])

    const stats = await repository.getBuyersStats({})

    expect(stats.newLast30Days).toBe(1)
    const [{ values }] = queryRaw.mock.calls[0] as [{ values: unknown[] }]
    expect(values).toContainEqual(new Date('2026-07-24T00:00:00.000Z'))
    jest.useRealTimers()
  })

  it('drops the purchase filter for tab counts while honouring every other filter', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([statsRow({ total_buyers: 2n, bought_count: 1n })])

    await repository.getBuyersStats({ purchase: 'bought', countryId: 7 })

    const { sql } = queryRaw.mock.calls[0][0] as { sql: string }
    expect(sql).not.toContain('orders o WHERE o.user_id = u.id')
    expect(sql).toContain('cp.country_id =')
  })

  it('ignores the purchase tab for every tile too, exactly like the tabs themselves', async () => {
    const { repository, queryRaw } = buildRepository()
    queryRaw.mockResolvedValueOnce([
      statsRow({
        total_buyers: 2n,
        bought_count: 1n,
        total_spent: '10.00',
        total_money_order_count: 1n,
      }),
    ])

    const stats = await repository.getBuyersStats({ purchase: 'never' })

    expect(stats.tabs.bought).toBe(1)
    expect(stats.totalBuyers).toBe(2)
    expect(stats.boughtCount).toBe(1)
    expect(stats.boughtPercent).toBe(50)
    expect(stats.averageTicket).toBe('10.00')
  })
})

describe('UserReadRepository getBuyerDetail', () => {
  it('returns null when no user matches the id', async () => {
    const { repository, findFirst } = buildRepository()
    findFirst.mockResolvedValueOnce(null)

    const detail = await repository.getBuyerDetail('missing')

    expect(detail).toBeNull()
  })

  it('returns null when the user is not a customer (findFirst scoped by role)', async () => {
    const { repository, findFirst } = buildRepository()
    findFirst.mockResolvedValueOnce(null)

    await repository.getBuyerDetail('non-customer')

    const { where } = findFirst.mock.calls[0][0]
    expect(where.user_roles).toEqual({ some: { role: { name: 'customer' } } })
  })

  it('returns an empty order history and zeroed figures for a buyer with no orders', async () => {
    const { repository, findFirst, orderFindMany, consentFindMany } = buildRepository()
    findFirst.mockResolvedValueOnce(buyerRowFixture)
    orderFindMany.mockResolvedValueOnce([])
    consentFindMany.mockResolvedValueOnce([])

    const detail = await repository.getBuyerDetail('buyer-1')

    expect(detail?.orders).toEqual([])
    expect(detail?.orderCount).toBe(0)
    expect(detail?.spent).toBe('0.00')
    expect(detail?.photoCount).toBe(0)
  })

  it("keeps each order's own payment method when two orders differ", async () => {
    const { repository, findFirst, orderFindMany, consentFindMany } = buildRepository()
    findFirst.mockResolvedValueOnce(buyerRowFixture)
    const detailOrderRows = [
      {
        id: 'order-1',
        status: 'paid',
        payment_method: 'card',
        subtotal: '10.00',
        created_at: new Date('2026-02-01'),
        event: { name: 'Vuelta al Valle' },
        _count: { items: 3 },
      },
      {
        id: 'order-2',
        status: 'delivered',
        payment_method: 'transfer',
        subtotal: '20.00',
        created_at: new Date('2026-03-01'),
        event: { name: 'Ruta del Café' },
        _count: { items: 5 },
      },
    ]
    const rowsForBuildBuyerAggregatesCall = detailOrderRows.map((row) => ({
      ...row,
      user_id: 'buyer-1',
      event_id: row.id,
    }))
    const rowsForOrderHistoryCall = detailOrderRows

    orderFindMany
      .mockResolvedValueOnce(rowsForBuildBuyerAggregatesCall)
      .mockResolvedValueOnce(rowsForOrderHistoryCall)
    consentFindMany.mockResolvedValueOnce([])

    const detail = await repository.getBuyerDetail('buyer-1')

    expect(detail?.orders.find((o) => o.id === 'order-1')?.paymentMethod).toBe('card')
    expect(detail?.orders.find((o) => o.id === 'order-2')?.paymentMethod).toBe('transfer')
  })

  it('renders consent rows as stored, without inventing semantic versions', async () => {
    const { repository, findFirst, orderFindMany, consentFindMany } = buildRepository()
    findFirst.mockResolvedValueOnce(buyerRowFixture)
    orderFindMany.mockResolvedValueOnce([])
    consentFindMany.mockResolvedValueOnce([
      {
        type: 'terms',
        policy_version: '2026-08-16',
        accepted_at: new Date('2026-08-16'),
      },
    ])

    const detail = await repository.getBuyerDetail('buyer-1')

    expect(detail?.consents).toEqual([
      { type: 'terms', policyVersion: '2026-08-16', acceptedAt: new Date('2026-08-16') },
    ])
  })

  it('keeps only the latest row per consent type, dropping an older accepted policy version', async () => {
    const { repository, findFirst, orderFindMany, consentFindMany } = buildRepository()
    findFirst.mockResolvedValueOnce(buyerRowFixture)
    orderFindMany.mockResolvedValueOnce([])
    consentFindMany.mockResolvedValueOnce([
      { type: 'terms', policy_version: '2026-08-16', accepted_at: new Date('2026-08-16') },
      { type: 'terms', policy_version: '2025-01-01', accepted_at: new Date('2025-01-01') },
      { type: 'privacy', policy_version: '2025-01-01', accepted_at: new Date('2025-01-01') },
    ])

    const detail = await repository.getBuyerDetail('buyer-1')

    expect(detail?.consents).toEqual([
      { type: 'terms', policyVersion: '2026-08-16', acceptedAt: new Date('2026-08-16') },
      { type: 'privacy', policyVersion: '2025-01-01', acceptedAt: new Date('2025-01-01') },
    ])
  })

  it('averages spent over paid and delivered orders only, excluding a gifted order', async () => {
    const { repository, findFirst, orderFindMany, consentFindMany } = buildRepository()
    findFirst.mockResolvedValueOnce(buyerRowFixture)
    const threeOrderRows = [
      {
        id: 'order-1',
        status: 'paid',
        payment_method: 'card',
        subtotal: '10.00',
        created_at: new Date('2026-01-01'),
        event: { name: 'Vuelta al Valle' },
        _count: { items: 2 },
      },
      {
        id: 'order-2',
        status: 'delivered',
        payment_method: 'transfer',
        subtotal: '20.00',
        created_at: new Date('2026-02-01'),
        event: { name: 'Ruta del Café' },
        _count: { items: 4 },
      },
      {
        id: 'order-3',
        status: 'gifted',
        payment_method: null,
        subtotal: '99.00',
        created_at: new Date('2026-03-01'),
        event: { name: 'Clásica de Otoño' },
        _count: { items: 1 },
      },
    ]
    const rowsForBuildBuyerAggregatesCall = threeOrderRows.map((row) => ({
      ...row,
      user_id: 'buyer-1',
      event_id: row.id,
    }))
    const rowsForOrderHistoryCall = threeOrderRows

    orderFindMany
      .mockResolvedValueOnce(rowsForBuildBuyerAggregatesCall)
      .mockResolvedValueOnce(rowsForOrderHistoryCall)
    consentFindMany.mockResolvedValueOnce([])

    const detail = await repository.getBuyerDetail('buyer-1')

    expect(detail?.averageTicket).toBe('15.00')
  })

  it('returns a zeroed average ticket for a buyer with no paid or delivered orders', async () => {
    const { repository, findFirst, orderFindMany, consentFindMany } = buildRepository()
    findFirst.mockResolvedValueOnce(buyerRowFixture)
    orderFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    consentFindMany.mockResolvedValueOnce([])

    const detail = await repository.getBuyerDetail('buyer-1')

    expect(detail?.averageTicket).toBe('0.00')
  })
})
