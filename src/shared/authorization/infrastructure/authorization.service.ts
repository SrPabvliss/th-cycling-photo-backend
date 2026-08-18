import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { EventScope } from '../domain/event-scope.vo'
import { PERMISSIONS, type PermissionKey } from '../domain/permission-catalog'
import type { IAuthorizationService } from '../domain/ports/authorization.service.port'
import {
  AUTHORIZATION_CACHE,
  type IAuthorizationCache,
} from '../domain/ports/authorization-cache.port'
import {
  type IPermissionRepository,
  PERMISSION_REPOSITORY,
} from '../domain/ports/permission-repository.port'
import type { PrincipalPermissions } from '../domain/principal'

/**
 * The authorization decision point. Every access check in the product routes
 * through `can`/`assert`. `resolveEventScope` answers a structurally
 * different question — which rows are in reach — and both must pass for a
 * request to succeed.
 *
 * Resolution order for `can` (most specific wins, no conflicts possible
 * within a level because of the unique `(user, permission, scope, event)`
 * index):
 *   0. unknown key            -> throw (programmer error, not a 403)
 *   1. platformOnly & !isPlatform -> deny, before any grant or template
 *   2. grant on this event    -> its effect
 *   3. a global grant         -> its effect
 *   4. the template           -> allow
 *   5. otherwise              -> deny
 */
@Injectable()
export class AuthorizationService implements IAuthorizationService {
  constructor(
    @Inject(PERMISSION_REPOSITORY) private readonly repo: IPermissionRepository,
    @Inject(AUTHORIZATION_CACHE) private readonly cache: IAuthorizationCache,
  ) {}

  async can(userId: string, key: PermissionKey, eventId?: string): Promise<boolean> {
    if (!Object.hasOwn(PERMISSIONS, key)) throw new Error(`Unknown permission key: ${String(key)}`)
    const meta = PERMISSIONS[key]

    const p = await this.principal(userId)

    // 1. platform-only permissions are ungrantable outside the platform tenant
    if (meta.platformOnly && !p.isPlatform) return false

    // 2. most specific: a grant on this event
    if (eventId) {
      const effect = p.eventGrants.get(eventId)?.get(key)
      if (effect) return effect === 'allow'
    }

    // 3. a global grant
    const global = p.globalGrants.get(key)
    if (global) return global === 'allow'

    // 4. the template
    if (p.templateKeys.has(key)) return true

    // 5. deny by default
    return false
  }

  async assert(userId: string, key: PermissionKey, eventId?: string): Promise<void> {
    if (!(await this.can(userId, key, eventId))) {
      throw new ForbiddenException('Insufficient permissions')
    }
  }

  /**
   * Which Event rows this user may see. `all` is driven strictly by holding
   * `event.read.all` — never by `isPlatform` alone. Platform membership only
   * makes platform-only permissions eligible; it does not by itself grant
   * sight of everything, or a restricted TitanTV staff member (e.g. a
   * retoucher on a narrow template) would see every event on the platform.
   *
   * Delegates the flag to `can()` rather than re-deriving it, so the same
   * precedence applies here as everywhere else: `platformOnly && !isPlatform`
   * denies before any grant is even consulted (a tenant can never reach
   * `unrestricted()` via this grant, no matter what's in `globalGrants`),
   * and an explicit deny on `event.read.all` overrides the template — it
   * does not fall through to `unrestricted()` just because the template
   * holds the key.
   */
  async resolveEventScope(userId: string): Promise<EventScope> {
    if (await this.can(userId, 'event.read.all')) return EventScope.unrestricted()

    const p = await this.principal(userId)

    const tenantIds = p.tenantId ? [p.tenantId] : []

    const granted = [...p.eventGrants.entries()]
      .filter(([, keys]) => [...keys.values()].some((e) => e === 'allow'))
      .map(([eventId]) => eventId)

    // TRANSITIONAL — EventOperator rows (via collaboratorEventIds) stand in
    // for per-event grants until TIT-40 converts them into real grants.
    // Delete this union and the collaboratorEventIds field then.
    const eventIds = [...new Set([...granted, ...p.collaboratorEventIds])]

    return new EventScope(false, tenantIds, eventIds)
  }

  protected async principal(userId: string): Promise<PrincipalPermissions> {
    const cached = await this.cache.get(userId)
    if (cached) return cached
    const loaded = await this.repo.load(userId)
    await this.cache.set(userId, loaded)
    return loaded
  }
}
