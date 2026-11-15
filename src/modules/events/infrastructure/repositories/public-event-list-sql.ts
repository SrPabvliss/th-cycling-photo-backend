import { Prisma } from '@generated/prisma/client'
import type { PublicEventListFilters } from '../../application/queries/get-public-events-list/get-public-events-list.dto'
import { PUBLICLY_LISTED_EVENT } from '../public-event-rule'
import { escapeLikeTerm } from './event-list-sql'

/**
 * Ids of the events whose name, canton or province contains the term, ignoring case and accents.
 * Needs the `unaccent` extension. `%` and `_` typed by the user are matched as literal text.
 */
export function publicEventSearchSql(search: string): Prisma.Sql {
  const pattern = `%${escapeLikeTerm(search)}%`
  return Prisma.sql`
    SELECT e.id
    FROM events e
    LEFT JOIN provinces pr ON pr.id = e.province_id
    LEFT JOIN cantons ct ON ct.id = e.canton_id
    WHERE e.deleted_at IS NULL
      AND (
        unaccent(e.name) ILIKE unaccent(${pattern}) ESCAPE '\\'
        OR unaccent(pr.name) ILIKE unaccent(${pattern}) ESCAPE '\\'
        OR unaccent(ct.name) ILIKE unaccent(${pattern}) ESCAPE '\\'
      )
  `
}

/** The filter groups of the public listing; each one's counts are taken without itself. */
export type PublicEventFilterGroup = 'eventTypes' | 'provinces' | 'months'

/**
 * `start_date` from the first day of `from` up to, not including, the first day of the month
 * after `to`. Built at UTC midnight, which is how Prisma reads and writes a `DATE` column, so the
 * bounds name calendar days and never shift with the server's time zone.
 */
export function startDateRange(from: string, to: string): { gte: Date; lt: Date } {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return {
    gte: new Date(Date.UTC(fromYear, fromMonth - 1, 1)),
    lt: new Date(Date.UTC(toYear, toMonth, 1)),
  }
}

/** `YYYY-MM` of a `DATE` value as Prisma returns it (UTC midnight of that day). */
export function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7)
}

/**
 * The one `where` behind the public listing and its filter counts. `searchIds` are the events the
 * search matched (`null` when there is no search). `without` drops one group's own filter, which is
 * how its options are counted.
 */
export function publicEventWhere(
  filters: PublicEventListFilters,
  searchIds: string[] | null,
  without?: PublicEventFilterGroup,
): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = { ...PUBLICLY_LISTED_EVENT }

  if (searchIds !== null) where.id = { in: searchIds }
  if (without !== 'eventTypes' && filters.eventTypeIds.length > 0) {
    where.event_type_id = { in: filters.eventTypeIds }
  }
  if (without !== 'provinces' && filters.provinceIds.length > 0) {
    where.province_id = { in: filters.provinceIds }
  }
  if (without !== 'months' && filters.from !== null && filters.to !== null) {
    where.start_date = startDateRange(filters.from, filters.to)
  }

  return where
}
