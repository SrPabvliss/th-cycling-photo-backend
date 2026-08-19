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
  /** Consent types still pending for the current policy version */
  pendingConsents?: string[]
  /** Effective global permission keys (event-scoped grants are not included) */
  permissions?: string[]
  /** Tenant the principal's permissions are scoped to, if any */
  tenantId?: string | null
  /** Whether the principal operates in the platform tenant */
  isPlatform?: boolean
}
