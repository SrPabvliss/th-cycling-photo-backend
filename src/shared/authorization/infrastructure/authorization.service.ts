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
 * The authorization decision point. `can`/`assert` answer "may this user do X"; `resolveEventScope`
 * answers "which rows are in reach". Both must pass for a request to succeed.
 *
 * Resolution order for `can` — most specific wins, with no conflicts possible within a level
 * thanks to the unique `(user, permission, scope, event)` index:
 *   0. unknown key                -> throw (programmer error, not a 403)
 *   1. platformOnly & !isPlatform -> deny, before any grant or template
 *   2. grant on this event        -> its effect
 *   3. a global grant             -> its effect
 *   4. the template               -> allow
 *   5. otherwise                  -> deny
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

  async canAnywhere(userId: string, key: PermissionKey): Promise<boolean> {
    if (await this.can(userId, key)) return true
    const p = await this.principal(userId)
    if (PERMISSIONS[key].platformOnly && !p.isPlatform) return false
    return [...p.eventGrants.values()].some((grants) => grants.get(key) === 'allow')
  }

  async assert(userId: string, key: PermissionKey, eventId?: string): Promise<void> {
    if (!(await this.can(userId, key, eventId))) {
      throw new ForbiddenException('Insufficient permissions')
    }
  }

  /**
   * Which Event rows this user may reach for `keys`. `all` comes strictly from holding
   * `event.read.all`, never from `isPlatform` alone — otherwise a narrowly-templated retoucher
   * would see every event.
   *
   * Per key, the tenant branch only opens when the key is held tenant-wide (template or global
   * grant, through `can()` so a global deny wins), explicit per-event denies of that key carve it,
   * and per-event allows of that key add single events. A grant on one event therefore never opens
   * the tenant, nor reaches a different verb. Several keys union their scopes.
   */
  async resolveEventScope(
    userId: string,
    keys: PermissionKey | PermissionKey[],
  ): Promise<EventScope> {
    if (await this.can(userId, 'event.read.all')) return EventScope.unrestricted()

    const list = Array.isArray(keys) ? keys : [keys]
    const scopes = await Promise.all(list.map((key) => this.scopeForKey(userId, key)))
    return scopes.length === 1 ? scopes[0] : EventScope.union(...scopes)
  }

  private async scopeForKey(userId: string, key: PermissionKey): Promise<EventScope> {
    const tenantWide = await this.can(userId, key)
    const p = await this.principal(userId)
    if (PERMISSIONS[key].platformOnly && !p.isPlatform) return EventScope.empty()

    const allowed: string[] = []
    const denied: string[] = []
    for (const [eventId, grants] of p.eventGrants) {
      const effect = grants.get(key)
      if (effect === 'allow') allowed.push(eventId)
      if (effect === 'deny') denied.push(eventId)
    }

    if (tenantWide && p.tenantId) return new EventScope(false, [p.tenantId], allowed, denied)
    return new EventScope(false, [], allowed)
  }

  protected async principal(userId: string): Promise<PrincipalPermissions> {
    const cached = await this.cache.get(userId)
    if (cached) return cached
    const loaded = await this.repo.load(userId)
    await this.cache.set(userId, loaded)
    return loaded
  }
}
