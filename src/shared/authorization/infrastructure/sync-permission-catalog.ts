// Imports here are deliberately RELATIVE rather than using the `@shared/…`
// / `@generated/…` tsconfig path aliases. This module is reachable from a
// standalone entry point (`sync-permission-catalog.cli.ts`) that production
// runs straight off `node dist/…` with no `tsconfig-paths/register` and no
// `tsx`. `nest build` does rewrite the aliases, but keeping these relative
// removes any dependence on that rewrite for the one code path whose whole
// point is to work outside the Nest runtime.
import type { PrismaClient } from '../../../generated/prisma/client'
import { ALL_PERMISSION_KEYS, PERMISSIONS } from '../domain/permission-catalog'
import {
  TEMPLATE_IS_PLATFORM_ONLY,
  TEMPLATE_KEYS,
  TEMPLATE_PERMISSIONS,
  type TemplateKey,
} from '../domain/permission-template.constants'

/**
 * Only the slice of the Prisma client this module touches. Typing the
 * parameter structurally (rather than as the full `PrismaClient`) lets the
 * seed, the CLI, and `PrismaService` all pass their own client without any
 * of them having to be the same nominal instance.
 *
 * `syncPermissions`, `syncPermissionTemplates` and `assertCatalogComplete`
 * all keep taking exactly this narrower type — Prisma's interactive
 * transaction client (`tx` below) satisfies it structurally without itself
 * exposing `$transaction`, so those three steps cannot open a nested
 * transaction even by accident.
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
      // permission_template_permissions has a composite primary key
      // (template_id, permission_id): two containers running this sync at
      // the same time on a fresh deploy would otherwise have one insert
      // collide on the other's row and crash-loop. Low odds on a
      // single-VPS deploy, but skipping the duplicate costs nothing.
      skipDuplicates: true,
    })
  }
  console.log(`Synced ${Object.values(TEMPLATE_KEYS).length} permission templates`)
}

/**
 * Fail-fast guard. The permission guard is fail-closed: a `permissions` table
 * that is short even one row silently 403s whichever routes depend on the
 * missing keys, and an *empty* one 403s every permissioned route in the
 * product for admins, staff and customers alike. Blowing up here — before the
 * application is allowed to start — beats locking everyone out quietly.
 */
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
 * Brings the `permissions` table and the four permission templates (rows and
 * membership) in line with the TypeScript constants that the authorization
 * engine reads at request time.
 *
 * This is NOT optional test data. The TIT-38 migrations create an empty
 * `permissions` table and four *empty* templates, then assign every existing
 * and future user one of them. Until this runs, every template resolves to
 * zero permissions and the fail-closed guard denies ~80 routes. It therefore
 * has to run on every deploy, right after `prisma migrate deploy` — see
 * `scripts/docker-entrypoint.sh`.
 *
 * Wrapped in a single `$transaction`. This now runs on every container
 * start, not once from a manual seed, and `syncPermissionTemplates` rewrites
 * each template's membership as `deleteMany` then `createMany` with no
 * transaction of its own. The authorization cache is request-scoped, so a
 * request landing inside that window would have resolved an empty template
 * and 403'd a real caller. Under a zero-downtime deploy — the old container
 * still serving while the new one runs the entrypoint — that window is real
 * on every deploy, not a one-off migration risk. Wrapping the whole sync
 * (permissions, all four templates, and the completeness assertion) in one
 * transaction makes the window disappear: readers either see the fully
 * pre-sync or fully post-sync catalog, never a mid-rewrite one.
 *
 * Idempotent: upserts, prunes removed keys, and rewrites template membership,
 * so re-running it converges rather than duplicating.
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
