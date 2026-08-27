export class MeProjection {
  /** User UUID */
  id: string
  /** User email */
  email: string
  /** First name */
  firstName: string | null
  /** Last name */
  lastName: string | null
  /** User role */
  role: string
  /** Whether the account's current email address has been verified */
  emailVerified: boolean
  /** Whether the account has the personal profile row every buyer gets at registration */
  hasPersonalProfile: boolean
  /** Whether this is a protected account, excluded from non-legal prompts */
  isProtected: boolean
  /** Consent types still pending for the current policy version */
  pendingConsents?: string[]
  /** Prompt keys pending, already ordered by priority and filtered by cooldowns */
  pendingPrompts?: string[]
  /** Effective global permission keys (event-scoped grants are not included) */
  permissions?: string[]
  /** Tenant the principal's permissions are scoped to, if any */
  tenantId?: string | null
  /** Whether the principal operates in the platform tenant */
  isPlatform?: boolean
}
