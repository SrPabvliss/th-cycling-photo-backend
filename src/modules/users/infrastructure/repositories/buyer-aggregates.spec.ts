import { type BuyerAggregate, buildBuyerAggregates } from './buyer-aggregates'

describe('buildBuyerAggregates', () => {
  const prisma = { order: { findMany: jest.fn() } }

  beforeEach(() => jest.clearAllMocks())

  it('returns zeroes for a buyer with no orders rather than omitting them', async () => {
    prisma.order.findMany.mockResolvedValue([])

    const result = await buildBuyerAggregates(prisma as never, ['user-1'])

    expect(result.get('user-1')).toEqual({
      orderCount: 0,
      spent: '0.00',
      photoCount: 0,
      eventCount: 0,
      eventNames: [],
      firstOrderAt: null,
      lastOrderAt: null,
      unpaidCount: 0,
    })
  })

  it('counts a gifted order but never adds it to the money spent', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        user_id: 'user-1',
        status: 'delivered',
        subtotal: '10.00',
        created_at: new Date('2026-01-01'),
        event_id: 'e1',
        event: { name: 'Ecuador OPEN' },
        _count: { items: 2 },
      },
      {
        user_id: 'user-1',
        status: 'gifted',
        subtotal: '7.00',
        created_at: new Date('2026-02-01'),
        event_id: 'e2',
        event: { name: 'Sigchos Fest' },
        _count: { items: 3 },
      },
    ])

    const a = result(await buildBuyerAggregates(prisma as never, ['user-1']))

    expect(a.orderCount).toBe(2)
    expect(a.spent).toBe('10.00')
    expect(a.eventCount).toBe(2)
  })

  it('counts photos from gifted orders too, but never their money', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        user_id: 'user-1',
        status: 'delivered',
        subtotal: '10.00',
        created_at: new Date('2026-01-01'),
        event_id: 'e1',
        event: { name: 'Ecuador OPEN' },
        _count: { items: 2 },
      },
      {
        user_id: 'user-1',
        status: 'gifted',
        subtotal: '7.00',
        created_at: new Date('2026-02-01'),
        event_id: 'e2',
        event: { name: 'Sigchos Fest' },
        _count: { items: 3 },
      },
    ])

    const a = result(await buildBuyerAggregates(prisma as never, ['user-1']))

    expect(a.photoCount).toBe(5)
    expect(a.spent).toBe('10.00')
  })

  it('treats pending and payment_info_sent as unpaid, and cancelled as neither', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        user_id: 'user-1',
        status: 'pending',
        subtotal: '5.00',
        created_at: new Date('2026-01-01'),
        event_id: 'e1',
        event: { name: 'A' },
        _count: { items: 1 },
      },
      {
        user_id: 'user-1',
        status: 'payment_info_sent',
        subtotal: '5.00',
        created_at: new Date('2026-01-02'),
        event_id: 'e1',
        event: { name: 'A' },
        _count: { items: 1 },
      },
      {
        user_id: 'user-1',
        status: 'cancelled',
        subtotal: '9.00',
        created_at: new Date('2026-01-03'),
        event_id: 'e1',
        event: { name: 'A' },
        _count: { items: 1 },
      },
    ])

    const a = result(await buildBuyerAggregates(prisma as never, ['user-1']))

    expect(a.unpaidCount).toBe(2)
    expect(a.spent).toBe('0.00')
  })

  it('dedupes eventNames by event id, not by name, so same-named events both count', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        user_id: 'user-1',
        status: 'delivered',
        subtotal: '3.00',
        created_at: new Date('2026-03-05'),
        event_id: 'e1',
        event: { name: 'Downhill El Bosque' },
        _count: { items: 1 },
      },
      {
        user_id: 'user-1',
        status: 'delivered',
        subtotal: '3.00',
        created_at: new Date('2026-01-05'),
        event_id: 'e2',
        event: { name: 'Downhill El Bosque' },
        _count: { items: 1 },
      },
    ])

    const a = result(await buildBuyerAggregates(prisma as never, ['user-1']))

    expect(a.eventCount).toBe(2)
    expect(a.eventNames).toEqual(['Downhill El Bosque', 'Downhill El Bosque'])
  })

  it('spans first and last purchase across every non-draft order', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        user_id: 'user-1',
        status: 'delivered',
        subtotal: '3.00',
        created_at: new Date('2026-03-05'),
        event_id: 'e1',
        event: { name: 'A' },
        _count: { items: 1 },
      },
      {
        user_id: 'user-1',
        status: 'delivered',
        subtotal: '3.00',
        created_at: new Date('2026-01-05'),
        event_id: 'e2',
        event: { name: 'B' },
        _count: { items: 1 },
      },
    ])

    const a = result(await buildBuyerAggregates(prisma as never, ['user-1']))

    expect(a.firstOrderAt).toEqual(new Date('2026-01-05'))
    expect(a.lastOrderAt).toEqual(new Date('2026-03-05'))
  })
})

function result(map: Map<string, BuyerAggregate>) {
  const value = map.get('user-1')
  if (!value) throw new Error('expected an aggregate for user-1')
  return value
}
