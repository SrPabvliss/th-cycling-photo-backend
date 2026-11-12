import { Prisma } from '@generated/prisma/client'
import { escapeLikeTerm } from './event-list-sql'

/**
 * What makes an event appear in the public listing. A cover image is required: without one the
 * event is still being set up and must not be visible to buyers.
 */
export const PUBLICLY_LISTED_EVENT = {
  deleted_at: null,
  status: 'active',
  assets: { some: { asset_type: 'cover_image' } },
} satisfies Prisma.EventWhereInput

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
