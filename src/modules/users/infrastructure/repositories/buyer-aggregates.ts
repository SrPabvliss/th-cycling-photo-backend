import { Prisma } from '@generated/prisma/client'
import type { PrismaService } from '@shared/infrastructure'

export interface BuyerAggregate {
  orderCount: number
  spent: string
  photoCount: number
  eventCount: number
  eventNames: string[]
  firstOrderAt: Date | null
  lastOrderAt: Date | null
  unpaidCount: number
}

type OrderRow = {
  user_id: string
  status: string
  subtotal: Prisma.Decimal | string | null
  created_at: Date
  event_id: string
  event: { name: string }
  _count: { items: number }
}

export const MONEY_STATUSES = ['paid', 'delivered']
const PHOTO_STATUSES = ['paid', 'delivered', 'gifted']
const UNPAID_STATUSES = ['pending', 'payment_info_sent']
const MAX_EVENT_NAMES = 3

export function toAverageTicket(spent: Prisma.Decimal, moneyOrderCount: number): string {
  return moneyOrderCount === 0 ? '0.00' : spent.dividedBy(moneyOrderCount).toFixed(2)
}

function emptyAggregate(): BuyerAggregate {
  return {
    orderCount: 0,
    spent: '0.00',
    photoCount: 0,
    eventCount: 0,
    eventNames: [],
    firstOrderAt: null,
    lastOrderAt: null,
    unpaidCount: 0,
  }
}

export async function buildBuyerAggregates(
  prisma: Pick<PrismaService, 'order'>,
  userIds: string[],
): Promise<Map<string, BuyerAggregate>> {
  const result = new Map<string, BuyerAggregate>(userIds.map((id) => [id, emptyAggregate()]))

  const rows = (await prisma.order.findMany({
    where: { user_id: { in: userIds }, status: { not: 'draft' } },
    select: {
      user_id: true,
      status: true,
      subtotal: true,
      created_at: true,
      event_id: true,
      event: { select: { name: true } },
      _count: { select: { items: true } },
    },
  })) as OrderRow[]

  const rowsByUser = new Map<string, OrderRow[]>()
  rows.forEach((row) => {
    rowsByUser.set(row.user_id, [...(rowsByUser.get(row.user_id) ?? []), row])
  })

  rowsByUser.forEach((userRows, userId) => {
    const moneyRows = userRows.filter((row) => MONEY_STATUSES.includes(row.status))
    const photoRows = userRows.filter((row) => PHOTO_STATUSES.includes(row.status))
    const spent = moneyRows
      .reduce((sum, row) => sum.plus(new Prisma.Decimal(row.subtotal ?? 0)), new Prisma.Decimal(0))
      .toFixed(2)

    const orderedByRecent = [...userRows].sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    )
    const distinctEventsByRecency = [
      ...new Map(orderedByRecent.map((row) => [row.event_id, row.event.name])).values(),
    ]
    const eventNames = distinctEventsByRecency.slice(0, MAX_EVENT_NAMES)

    const createdTimes = userRows.map((row) => row.created_at.getTime())

    result.set(userId, {
      orderCount: userRows.length,
      spent,
      photoCount: photoRows.reduce((sum, row) => sum + row._count.items, 0),
      eventCount: new Set(userRows.map((row) => row.event_id)).size,
      eventNames,
      firstOrderAt: userRows.length ? new Date(Math.min(...createdTimes)) : null,
      lastOrderAt: userRows.length ? new Date(Math.max(...createdTimes)) : null,
      unpaidCount: userRows.filter((row) => UNPAID_STATUSES.includes(row.status)).length,
    })
  })

  return result
}
