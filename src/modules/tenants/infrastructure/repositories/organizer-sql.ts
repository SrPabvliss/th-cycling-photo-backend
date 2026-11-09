import { Prisma } from '@generated/prisma/client'

export function escapeLikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export function organizerSearchSql(search: string | undefined): Prisma.Sql {
  if (!search) return Prisma.empty
  const pattern = `%${escapeLikeTerm(search)}%`
  return Prisma.sql`AND (
    t.name ILIKE ${pattern} ESCAPE '\\' OR
    EXISTS (
      SELECT 1 FROM users hu
      WHERE hu.tenant_id = t.id AND hu.email ILIKE ${pattern} ESCAPE '\\'
    )
  )`
}

export function invitationSearchSql(search: string | undefined): Prisma.Sql {
  if (!search) return Prisma.empty
  const pattern = `%${escapeLikeTerm(search)}%`
  return Prisma.sql`AND (
    k.commercial_name ILIKE ${pattern} ESCAPE '\\' OR
    hu.email ILIKE ${pattern} ESCAPE '\\'
  )`
}

export const CONTRACT_USAGE_SQL = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS used
    FROM events e
    WHERE e.contract_id = k.id AND (e.deleted_at IS NULL OR e.photos_uploaded > 0)
  ) usage ON TRUE
`

export const ORGANIZER_AGG_SQL = Prisma.sql`
  SELECT
    k.tenant_id,
    COALESCE(SUM(GREATEST(k.events_total - k.used, 0)) FILTER (WHERE k.is_valid), 0)::int AS available,
    COALESCE(SUM(k.events_total) FILTER (WHERE k.is_valid), 0)::int AS total_capacity,
    COALESCE(SUM(LEAST(k.used, k.events_total)) FILTER (WHERE k.is_valid), 0)::int AS used_capacity,
    MIN(k.valid_until) FILTER (WHERE k.is_valid) AS next_expiry,
    MAX(k.valid_until) AS last_expiry,
    COUNT(*) FILTER (WHERE k.is_valid)::int AS valid_contract_count,
    COALESCE(SUM(GREATEST(k.events_total - k.used, 0))
      FILTER (WHERE k.status = 'accepted' AND NOT k.is_valid), 0)::int AS lost_slots,
    (COUNT(DISTINCT COALESCE(k.photos_per_event, -1)) FILTER (WHERE k.is_valid) > 1) AS photo_limits_differ
  FROM contracts k
  GROUP BY k.tenant_id
`
