import { AsyncLocalStorage } from 'node:async_hooks'
import { Injectable } from '@nestjs/common'
import type { IAuthorizationCache } from '../../domain/ports/authorization-cache.port'
import type { PrincipalPermissions } from '../../domain/principal'

/**
 * Per-request memoisation of resolved `PrincipalPermissions`, opened by `RequestIdMiddleware`. It
 * never outlives the request, so it can't go stale. Cross-request caching is deliberately out of
 * scope — a stale permission cache is a security bug.
 */
export const authorizationStore = new AsyncLocalStorage<Map<string, PrincipalPermissions>>()

/**
 * `IAuthorizationCache` adapter over `authorizationStore`. Uses `AsyncLocalStorage` rather than a
 * Nest `REQUEST`-scoped provider, which would propagate request scope up the whole injection chain.
 *
 * With no store present (background jobs, tests) `get` resolves to `null` and the writes no-op.
 */
@Injectable()
export class RequestScopedAuthorizationCache implements IAuthorizationCache {
  async get(userId: string): Promise<PrincipalPermissions | null> {
    return authorizationStore.getStore()?.get(userId) ?? null
  }

  async set(userId: string, value: PrincipalPermissions): Promise<void> {
    authorizationStore.getStore()?.set(userId, value)
  }

  async invalidate(userId: string): Promise<void> {
    authorizationStore.getStore()?.delete(userId)
  }
}
