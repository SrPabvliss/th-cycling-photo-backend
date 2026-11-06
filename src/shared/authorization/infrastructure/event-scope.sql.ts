import { Prisma } from '@generated/prisma/client'
import type { EventScope } from '../domain/event-scope.vo'

/**
 * Raw-SQL equivalent of `EventScope.toPrisma()`, as a boolean expression over the `events` row
 * aliased `alias`. `alias` is interpolated unescaped via `Prisma.raw`, so it must never come from
 * user input.
 */
export function eventScopeSql(scope: EventScope, alias: string): Prisma.Sql {
  if (scope.all) return Prisma.sql`TRUE`
  const e = Prisma.raw(alias)
  return Prisma.sql`((${e}.tenant_id = ANY(${scope.tenantIds}::uuid[]) AND NOT (${e}.id = ANY(${scope.deniedEventIds}::uuid[]))) OR ${e}.id = ANY(${scope.eventIds}::uuid[]))`
}
