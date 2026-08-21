import { Prisma } from '@generated/prisma/client'
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service'

/** The top-level client or a transaction's `tx`, so this can be called from inside `$transaction`. */
export type QueryablePrisma = PrismaService | Prisma.TransactionClient

/**
 * Counts active platform-tenant users whose *effective* `permission.grant` resolves to `allow` —
 * who could still manage permissions if the account in question lost it.
 *
 * Counting template membership alone would undercount, missing holders who have the key through a
 * direct grant. So this follows `AuthorizationService.can()`'s precedence for a key with no event
 * scope: a global grant (allow or deny) beats template membership.
 *
 * Three calling conventions:
 * - `excludeUserId` set — the post-removal holder count, which is what a deactivation needs.
 * - no argument — the total; `RevokePermissionHandler` applies its own `<= 1` threshold.
 * - no argument, inside a transaction — `ApplyTemplateHandler` counts after its `update`, so the
 *   total already is the post-swap count and throwing rolls the update back.
 */
export async function countActivePermissionGrantHolders(
  prisma: QueryablePrisma,
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
