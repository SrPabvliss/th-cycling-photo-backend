import type { EventScope } from '../event-scope.vo'
import type { PermissionKey } from '../permission-catalog'

export const AUTHORIZATION_SERVICE = Symbol('AUTHORIZATION_SERVICE')

export interface IAuthorizationService {
  can(userId: string, key: PermissionKey, eventId?: string): Promise<boolean>
  assert(userId: string, key: PermissionKey, eventId?: string): Promise<void>
  resolveEventScope(userId: string): Promise<EventScope>
}
