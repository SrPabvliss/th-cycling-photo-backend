import type { PermissionKey } from '../permission-catalog'

export const AUTHORIZATION_SERVICE = Symbol('AUTHORIZATION_SERVICE')

/**
 * Widened by Task 7, which adds `resolveEventScope(userId): Promise<EventScope>`
 * once `../event-scope.vo` exists.
 */
export interface IAuthorizationService {
  can(userId: string, key: PermissionKey, eventId?: string): Promise<boolean>
  assert(userId: string, key: PermissionKey, eventId?: string): Promise<void>
}
