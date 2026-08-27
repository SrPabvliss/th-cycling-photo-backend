import type { EventAggregate } from '@events/domain/ports/event-aggregate'
import { Prisma } from '@generated/prisma/client'
import type { PrismaService } from '@shared/infrastructure'

export type { EventAggregate } from '@events/domain/ports/event-aggregate'

type PhotoAggregateRow = {
  event_id: string
  reviewed_count: number
  categorized_count: number
  last_upload_at: Date | null
}

type OrderAggregateRow = {
  event_id: string
  revenue: Prisma.Decimal | string | null
  paid_count: number
  delivered_count: number
  gifted_count: number
  unpaid_count: number
  cancelled_count: number
  sold_photo_count: number
}

function emptyAggregate(): EventAggregate {
  return {
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
  }
}

export async function buildEventAggregates(
  prisma: Pick<PrismaService, '$queryRaw'>,
  eventIds: string[],
): Promise<Map<string, EventAggregate>> {
  const result = new Map<string, EventAggregate>(eventIds.map((id) => [id, emptyAggregate()]))

  if (eventIds.length === 0) return result

  const ids = Prisma.join(eventIds.map((id) => Prisma.sql`${id}::uuid`))

  const [photoRows, orderRows] = await Promise.all([
    prisma.$queryRaw<PhotoAggregateRow[]>`
      SELECT
        p.event_id,
        COUNT(*) FILTER (WHERE p.reviewed_at IS NOT NULL)::int AS reviewed_count,
        COUNT(*) FILTER (WHERE p.photo_category_id IS NOT NULL)::int AS categorized_count,
        MAX(p.uploaded_at) AS last_upload_at
      FROM photos p
      WHERE p.event_id IN (${ids})
      GROUP BY p.event_id
    `,
    prisma.$queryRaw<OrderAggregateRow[]>`
      SELECT
        o.event_id,
        COALESCE(SUM(o.subtotal) FILTER (WHERE o.status IN ('paid', 'delivered')), 0) AS revenue,
        COUNT(*) FILTER (WHERE o.status = 'paid')::int AS paid_count,
        COUNT(*) FILTER (WHERE o.status = 'delivered')::int AS delivered_count,
        COUNT(*) FILTER (WHERE o.status = 'gifted')::int AS gifted_count,
        COUNT(*) FILTER (WHERE o.status IN ('pending', 'payment_info_sent'))::int AS unpaid_count,
        COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_count,
        (
          SELECT COUNT(*)::int
          FROM order_items oi
          JOIN orders o2 ON o2.id = oi.order_id
          WHERE o2.event_id = o.event_id AND o2.status IN ('paid', 'delivered')
        ) AS sold_photo_count
      FROM orders o
      WHERE o.event_id IN (${ids}) AND o.status <> 'draft'
      GROUP BY o.event_id
    `,
  ])

  photoRows.forEach((row) => {
    const current = result.get(row.event_id) ?? emptyAggregate()
    result.set(row.event_id, {
      ...current,
      reviewedCount: row.reviewed_count,
      categorizedCount: row.categorized_count,
      lastUploadAt: row.last_upload_at,
    })
  })

  orderRows.forEach((row) => {
    const current = result.get(row.event_id) ?? emptyAggregate()
    result.set(row.event_id, {
      ...current,
      revenue: new Prisma.Decimal(row.revenue ?? 0).toFixed(2),
      paidCount: row.paid_count,
      deliveredCount: row.delivered_count,
      giftedCount: row.gifted_count,
      unpaidCount: row.unpaid_count,
      cancelledCount: row.cancelled_count,
      soldPhotoCount: row.sold_photo_count,
    })
  })

  return result
}
