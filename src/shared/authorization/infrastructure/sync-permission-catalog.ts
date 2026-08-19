// Relative imports, not `@shared/…` aliases: the CLI entry point runs off plain `node dist/…`
// with no `tsconfig-paths/register`.
import type { PrismaClient } from '../../../generated/prisma/client'
import { ALL_PERMISSION_KEYS, PERMISSIONS } from '../domain/permission-catalog'
import {
  TEMPLATE_IS_PLATFORM_ONLY,
  TEMPLATE_KEYS,
  TEMPLATE_PERMISSIONS,
  type TemplateKey,
} from '../domain/permission-template.constants'

/**
 * Structural (not nominal) so the seed, the CLI and `PrismaService` can each pass their own client.
 * Omitting `$transaction` also stops the inner steps from nesting a transaction by accident.
 */
export type PermissionCatalogClient = Pick<
  PrismaClient,
  'permission' | 'permissionTemplate' | 'permissionTemplatePermission'
>

/** What `syncPermissionCatalog` itself needs: the above, plus `$transaction`. */
export type TransactionalPermissionCatalogClient = PermissionCatalogClient &
  Pick<PrismaClient, '$transaction'>

export const TEMPLATE_NAMES: Record<TemplateKey, string> = {
  platform_admin: 'TitanTV Administrator',
  platform_staff: 'TitanTV Staff',
  tenant: 'Tenant',
  customer: 'Customer',
}

/**
 * Upserts every key in `PERMISSIONS` and prunes any row whose key has since
 * been removed from the constant. Idempotent.
 */
async function syncPermissions(prisma: PermissionCatalogClient): Promise<void> {
  for (const [key, meta] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { key },
      update: {
        category: meta.category,
        is_platform_only: meta.platformOnly,
        allows_event_scope: meta.eventScope,
      },
      create: {
        key,
        category: meta.category,
        is_platform_only: meta.platformOnly,
        allows_event_scope: meta.eventScope,
      },
    })
  }
  // drift in the other direction: a key removed from the constant
  await prisma.permission.deleteMany({ where: { key: { notIn: ALL_PERMISSION_KEYS } } })
  console.log(`Synced ${ALL_PERMISSION_KEYS.length} permissions`)
}

/**
 * Upserts the four template rows and rewrites their membership from
 * `TEMPLATE_PERMISSIONS`. Membership is replaced wholesale (delete + insert)
 * so a key removed from a template array is removed from the database too.
 * Idempotent.
 */
async function syncPermissionTemplates(prisma: PermissionCatalogClient): Promise<void> {
  for (const key of Object.values(TEMPLATE_KEYS)) {
    const tpl = await prisma.permissionTemplate.upsert({
      where: { key },
      update: { name: TEMPLATE_NAMES[key], is_platform_only: TEMPLATE_IS_PLATFORM_ONLY[key] },
      create: { key, name: TEMPLATE_NAMES[key], is_platform_only: TEMPLATE_IS_PLATFORM_ONLY[key] },
    })
    await prisma.permissionTemplatePermission.deleteMany({ where: { template_id: tpl.id } })
    const perms = await prisma.permission.findMany({
      where: { key: { in: TEMPLATE_PERMISSIONS[key] } },
      select: { id: true },
    })
    await prisma.permissionTemplatePermission.createMany({
      data: perms.map((p) => ({ template_id: tpl.id, permission_id: p.id })),
      // two containers syncing concurrently would otherwise collide on the composite PK
      skipDuplicates: true,
    })
  }
  console.log(`Synced ${Object.values(TEMPLATE_KEYS).length} permission templates`)
}

/** The guard is fail-closed, so a short catalog silently 403s routes. Better to refuse to boot. */
async function assertCatalogComplete(prisma: PermissionCatalogClient): Promise<void> {
  const actual = await prisma.permission.count()
  if (actual !== ALL_PERMISSION_KEYS.length) {
    throw new Error(
      `Permission catalog is incomplete: the permissions table holds ${actual} rows but ` +
        `ALL_PERMISSION_KEYS declares ${ALL_PERMISSION_KEYS.length}. The application would ` +
        'fail closed on every permissioned route — refusing to continue.',
    )
  }
}

/**
 * Syncs the `permissions` table and the four templates with the TypeScript constants. Idempotent.
 *
 * Not optional test data: the migrations create the catalog empty, so until this runs every
 * template resolves to zero permissions and the fail-closed guard denies ~80 routes. Runs on every
 * deploy right after `prisma migrate deploy` — see `scripts/docker-entrypoint.sh`.
 *
 * One transaction, because template membership is rewritten as delete + insert and a concurrent
 * request landing in that window would resolve an empty template and 403 a real caller.
 */
export async function syncPermissionCatalog(
  prisma: TransactionalPermissionCatalogClient,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await syncPermissions(tx)
    await syncPermissionTemplates(tx)
    await assertCatalogComplete(tx)
  })
}
