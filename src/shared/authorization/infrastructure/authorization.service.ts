import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { PERMISSIONS, type PermissionKey } from '../domain/permission-catalog'
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
 * through `can`/`assert`.
 *
 * Deliberately does NOT `implements IAuthorizationService` yet: the port
 * currently declares only `can`/`assert` (Task 5), but Task 7 widens it with
 * `resolveEventScope` and appends that method to this same class. Declaring
 * the interface here early would force a premature, incomplete implements
 * clause.
 *
 * Resolution order (most specific wins, no conflicts possible within a level
 * because of the unique `(user, permission, scope, event)` index):
 *   0. unknown key            -> throw (programmer error, not a 403)
 *   1. platformOnly & !isPlatform -> deny, before any grant or template
 *   2. grant on this event    -> its effect
 *   3. a global grant         -> its effect
 *   4. the template           -> allow
 *   5. otherwise              -> deny
 */
@Injectable()
export class AuthorizationService {
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

  protected async principal(userId: string): Promise<PrincipalPermissions> {
    const cached = await this.cache.get(userId)
    if (cached) return cached
    const loaded = await this.repo.load(userId)
    await this.cache.set(userId, loaded)
    return loaded
  }
}
