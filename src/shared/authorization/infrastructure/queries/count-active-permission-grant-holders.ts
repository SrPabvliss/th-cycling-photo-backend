import { Prisma } from '@generated/prisma/client'
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service'

/**
 * Counts active platform-tenant users whose *effective* `permission.grant`
 * resolves to `allow` — the population that could still manage
 * permissions if the account in question were removed from it.
 *
 * Ruling 4 (TIT-38 Task 13): the naive version of this query — counting
 * template membership only — undercounts. A user who holds
 * `permission.grant` through a direct UBAC grant rather than a template
 * would not be counted, so the query could return 0 while a real holder
 * is still active, wrongly permitting the revoke/deactivation that
 * removes them. This version follows the same precedence
 * `AuthorizationService.can()` uses for a key with no event scope: a
 * global grant (allow *or* deny) beats template membership; only when
 * there is no grant at all does template membership decide.
 *
 * Pass `excludeUserId` to answer "how many holders would remain if this
 * user were removed" in one query — the question a deactivation needs.
 * Because the excluded user's own row is dropped from the count
 * regardless of whether they hold the permission, this number is exactly
 * the post-removal holder count: unaffected deactivations (the excluded
 * user isn't a holder) leave the count unchanged, and the true
 * last-holder case (the excluded user is the sole holder) correctly
 * drops it to 0. `RevokePermissionHandler` calls this without
 * `excludeUserId` and applies its own `<= 1` threshold instead, per its
 * spec (see that handler's doc comment).
 */
export async function countActivePermissionGrantHolders(
  prisma: PrismaService,
  excludeUserId?: string,
): Promise<number> {
  const excludeFilter = excludeUserId
    ? Prisma.sql`AND u.id != ${excludeUserId}::uuid`
    : Prisma.empty

  const rows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT u.id)::bigint AS count
    FROM users u
    JOIN tenants t ON t.id = u.tenant_id AND t.is_platform
    LEFT JOIN user_permission_grants g
      ON g.user_id = u.id
      AND g.scope_type = 'global'
      AND g.permission_id = (SELECT id FROM permissions WHERE key = 'permission.grant')
    LEFT JOIN permission_template_permissions ptp
      ON ptp.template_id = u.permission_template_id
      AND ptp.permission_id = (SELECT id FROM permissions WHERE key = 'permission.grant')
    WHERE u.is_active
      ${excludeFilter}
      AND (
        g.effect = 'allow'
        OR (g.effect IS NULL AND ptp.permission_id IS NOT NULL)
      )
  `)

  return Number(rows[0]?.count ?? 0)
}
