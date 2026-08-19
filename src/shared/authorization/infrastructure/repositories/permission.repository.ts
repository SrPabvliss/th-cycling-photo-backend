import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { isPermissionKey, type PermissionKey } from '../../domain/permission-catalog'
import type { IPermissionRepository } from '../../domain/ports/permission-repository.port'
import {
  EMPTY_PRINCIPAL_PERMISSIONS,
  type GrantEffectValue,
  type PrincipalPermissions,
} from '../../domain/principal'

/**
 * Loads everything the decision point needs about a principal in one query: template permissions,
 * global and per-event grants, tenant/platform status, and (transitionally) `EventOperator` rows.
 *
 * An unknown user yields `EMPTY_PRINCIPAL_PERMISSIONS()` rather than throwing — the guard depends
 * on deny-by-default, not on exceptions.
 */
@Injectable()
export class PermissionRepository implements IPermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async load(userId: string): Promise<PrincipalPermissions> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        tenant_id: true,
        tenant: { select: { is_platform: true } },
        permission_template: {
          select: { permissions: { select: { permission: { select: { key: true } } } } },
        },
        permission_grants: {
          select: {
            scope_type: true,
            event_id: true,
            effect: true,
            permission: { select: { key: true } },
          },
        },
        assigned_events: { select: { event_id: true } },
      },
    })

    if (!user) return EMPTY_PRINCIPAL_PERMISSIONS()

    const result = EMPTY_PRINCIPAL_PERMISSIONS()
    result.tenantId = user.tenant_id
    result.isPlatform = user.tenant?.is_platform ?? false
    result.collaboratorEventIds = user.assigned_events.map((a) => a.event_id)

    for (const tp of user.permission_template?.permissions ?? []) {
      if (isPermissionKey(tp.permission.key)) result.templateKeys.add(tp.permission.key)
    }

    for (const g of user.permission_grants) {
      if (!isPermissionKey(g.permission.key)) continue
      const key: PermissionKey = g.permission.key
      const effect = g.effect as GrantEffectValue

      if (g.scope_type === 'global') {
        result.globalGrants.set(key, effect)
      } else if (g.event_id) {
        const perEvent =
          result.eventGrants.get(g.event_id) ?? new Map<PermissionKey, GrantEffectValue>()
        perEvent.set(key, effect)
        result.eventGrants.set(g.event_id, perEvent)
      }
    }

    return result
  }
}
