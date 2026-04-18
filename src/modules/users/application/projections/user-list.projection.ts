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
}
