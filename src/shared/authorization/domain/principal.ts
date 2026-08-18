import type { PermissionKey } from './permission-catalog'

export type GrantEffectValue = 'allow' | 'deny'

/** Mirrors the `grant_scope_type` DB enum without leaking a generated Prisma type into the domain layer. */
export type GrantScopeType = 'global' | 'event'

export interface PrincipalPermissions {
  templateKeys: Set<PermissionKey>
  globalGrants: Map<PermissionKey, GrantEffectValue>
  eventGrants: Map<string, Map<PermissionKey, GrantEffectValue>>
  tenantId: string | null
  isPlatform: boolean
  /**
   * TRANSITIONAL — sourced from `EventOperator` rows (`User.assigned_events`).
   * Task 7 unions this into event scope resolution; TIT-38's Task 40 removes
   * it once collaborator assignment is fully replaced by grants.
   */
  collaboratorEventIds: string[]
}

export interface Principal {
  userId: string
  email: string
}

export const EMPTY_PRINCIPAL_PERMISSIONS = (): PrincipalPermissions => ({
  templateKeys: new Set(),
  globalGrants: new Map(),
  eventGrants: new Map(),
  tenantId: null,
  isPlatform: false,
  collaboratorEventIds: [],
})
