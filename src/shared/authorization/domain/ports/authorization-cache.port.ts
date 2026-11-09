import type { PrincipalPermissions } from '../principal'

export const AUTHORIZATION_CACHE = Symbol('AUTHORIZATION_CACHE')

export interface IAuthorizationCache {
  get(userId: string): Promise<PrincipalPermissions | null>
  set(userId: string, value: PrincipalPermissions): Promise<void>
  invalidate(userId: string): Promise<void>
}
