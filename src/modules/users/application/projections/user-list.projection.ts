export class UserListProjection {
  /** User UUID */
  id: string
  /** User email address */
  email: string
  /** First name */
  firstName: string | null
  /** Last name */
  lastName: string | null
  /** Avatar URL (real or DiceBear fallback) */
  avatarUrl: string
  /** Whether the user account is active */
  isActive: boolean
  /** Assigned role names */
  roles: string[]
  /** Account creation date */
  createdAt: Date
  /** Whether the user has verified their email address */
  emailVerified: boolean
  /** Id of the organizador this user already runs, null if none (always null for the platform tenant) */
  organizerId: string | null
  /** Name of the organizador this user already runs, null if none */
  organizerName: string | null
}
