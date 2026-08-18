import { AsyncLocalStorage } from 'node:async_hooks'
import { Injectable } from '@nestjs/common'
import type { IAuthorizationCache } from '../../domain/ports/authorization-cache.port'
import type { PrincipalPermissions } from '../../domain/principal'

/**
 * Per-request memoisation store for resolved `PrincipalPermissions`.
 *
 * Opened once per request by `RequestIdMiddleware` and torn down when the
 * request finishes — it cannot go stale because it never outlives the
 * request. This is deliberately NOT a cross-request cache: a stale
 * permission cache is a security bug, so cross-request caching (Redis,
 * keyed on `permissions_version`) is deferred to a later task instead of
 * being bolted on here.
 */
export const authorizationStore = new AsyncLocalStorage<Map<string, PrincipalPermissions>>()

/**
 * `IAuthorizationCache` adapter backed by `authorizationStore`.
 *
 * Deliberately implemented with `AsyncLocalStorage` instead of a Nest
 * `REQUEST`-scoped provider: request scope propagates up the entire
 * injection chain, silently making every consumer (and every consumer of
 * those consumers) request-scoped, which is a serious performance
 * regression. `AsyncLocalStorage` keeps this a singleton provider while
 * still isolating state per request.
 *
 * Degrades gracefully with no store present (e.g. background jobs, BullMQ
 * processors, tests): `get` resolves to `null`, `set`/`invalidate` are
 * no-ops rather than throwing.
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
