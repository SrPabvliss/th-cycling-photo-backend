import { Prisma } from '@generated/prisma/client'
import {
  CONTRACT_USAGE_SQL,
  escapeLikeTerm,
  ORGANIZER_AGG_SQL,
  organizerSearchSql,
} from './organizer-sql'

describe('escapeLikeTerm', () => {
  it('escapes the LIKE metacharacters so a literal percent stays literal', () => {
    expect(escapeLikeTerm('100%_x')).toBe('100\\%\\_x')
  })
})

describe('organizerSearchSql', () => {
  it('is empty when there is nothing to search for', () => {
    expect(organizerSearchSql(undefined)).toBe(Prisma.empty)
    expect(organizerSearchSql('')).toBe(Prisma.empty)
  })

  it('binds the pattern instead of interpolating it', () => {
    const sql = organizerSearchSql('bike')
    expect(sql.values).toContain('%bike%')
    expect(sql.sql).not.toContain('bike')
  })
})

describe('CONTRACT_USAGE_SQL', () => {
  it('counts a slot as consumed when the event is live or was deleted after receiving photos', () => {
    expect(CONTRACT_USAGE_SQL.sql).toContain('e.deleted_at IS NULL OR e.photos_uploaded > 0')
  })
})

describe('ORGANIZER_AGG_SQL', () => {
  it('treats a null photo limit as its own value when deciding whether limits differ', () => {
    expect(ORGANIZER_AGG_SQL.sql).toContain('COALESCE(k.photos_per_event, -1)')
  })

  it('excludes expired contracts from available and total capacity', () => {
    expect(ORGANIZER_AGG_SQL.sql).toContain('FILTER (WHERE k.is_valid)')
  })
})
