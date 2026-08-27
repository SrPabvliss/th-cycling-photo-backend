import type {
  EventListFilters,
  EventSort,
  EventTab,
} from '@events/application/queries/get-events-list/get-events-list.dto'
import { Prisma } from '@generated/prisma/client'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'

export function escapeLikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export function resolveEventTab(tab: EventTab | undefined): EventTab {
  return tab === 'active' ||
    tab === 'no_cover' ||
    tab === 'frozen' ||
    tab === 'archived' ||
    tab === 'all'
    ? tab
    : 'all'
}

export function resolveEventSort(sort: EventSort | undefined): EventSort {
  return sort === 'name' ||
    sort === 'quota' ||
    sort === 'activity' ||
    sort === 'pending_review' ||
    sort === 'revenue'
    ? sort
    : 'event_date'
}

function uuidListSql(ids: string[]): Prisma.Sql {
  return Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))
}

function scopeSql(scope: EventScope): Prisma.Sql {
  if (scope.all) return Prisma.sql`TRUE`

  const reaches: Prisma.Sql[] = []
  if (scope.tenantIds.length > 0) {
    reaches.push(Prisma.sql`e.tenant_id IN (${uuidListSql(scope.tenantIds)})`)
  }
  if (scope.eventIds.length > 0) {
    reaches.push(Prisma.sql`e.id IN (${uuidListSql(scope.eventIds)})`)
  }
  if (reaches.length === 0) return Prisma.sql`FALSE`

  return Prisma.sql`(${Prisma.join(reaches, ' OR ')})`
}

export function eventTabConditionSql(tab: EventTab): Prisma.Sql {
  switch (tab) {
    case 'active':
      return Prisma.sql`e.deleted_at IS NULL`
    case 'no_cover':
      return Prisma.sql`e.deleted_at IS NULL AND NOT EXISTS (
      SELECT 1 FROM event_assets a WHERE a.event_id = e.id AND a.asset_type = 'cover_image'
    )`
    case 'frozen':
      return Prisma.sql`e.is_frozen = TRUE`
    case 'archived':
      return Prisma.sql`e.deleted_at IS NOT NULL`
    default:
      return Prisma.sql`TRUE`
  }
}

function searchConditionSql(search: string): Prisma.Sql {
  const pattern = `%${escapeLikeTerm(search)}%`
  return Prisma.sql`(
    e.name ILIKE ${pattern} ESCAPE '\\'
    OR EXISTS (
      SELECT 1 FROM provinces pr WHERE pr.id = e.province_id AND pr.name ILIKE ${pattern} ESCAPE '\\'
    )
    OR EXISTS (
      SELECT 1 FROM cantons ct WHERE ct.id = e.canton_id AND ct.name ILIKE ${pattern} ESCAPE '\\'
    )
  )`
}

export function eventListWhereSql(
  filters: EventListFilters,
  scope: EventScope,
  tab: EventTab,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [scopeSql(scope), eventTabConditionSql(tab)]

  if (filters.organizerId) {
    conditions.push(Prisma.sql`e.tenant_id = ${filters.organizerId}::uuid`)
  }
  if (filters.search) {
    conditions.push(searchConditionSql(filters.search))
  }

  return Prisma.join(conditions, ' AND ')
}

const PHOTO_LATERAL_SORTS: EventSort[] = ['activity', 'pending_review']

export function eventSortLateralSql(sort: EventSort): Prisma.Sql {
  if (PHOTO_LATERAL_SORTS.includes(sort)) {
    return Prisma.sql`
      LEFT JOIN LATERAL (
        SELECT
          MAX(p.uploaded_at) AS last_upload,
          COUNT(*) FILTER (WHERE p.reviewed_at IS NULL) AS pending_review
        FROM photos p
        WHERE p.event_id = c.id
      ) ph ON TRUE
    `
  }
  if (sort === 'revenue') {
    return Prisma.sql`
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(o.subtotal) FILTER (WHERE o.status IN ('paid', 'delivered')), 0) AS revenue
        FROM orders o
        WHERE o.event_id = c.id
      ) ord ON TRUE
    `
  }
  return Prisma.empty
}

export function eventSortSql(sort: EventSort): Prisma.Sql {
  if (sort === 'name') return Prisma.sql`c.name ASC`
  if (sort === 'quota') {
    return Prisma.sql`c.photos_uploaded::float / NULLIF(c.photo_quota, 0) DESC NULLS LAST`
  }
  if (sort === 'activity') return Prisma.sql`COALESCE(ph.last_upload, c.created_at) DESC`
  if (sort === 'pending_review') return Prisma.sql`ph.pending_review DESC NULLS LAST`
  if (sort === 'revenue') return Prisma.sql`ord.revenue DESC NULLS LAST`
  return Prisma.sql`c.start_date DESC`
}
