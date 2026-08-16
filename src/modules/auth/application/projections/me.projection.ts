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
}
