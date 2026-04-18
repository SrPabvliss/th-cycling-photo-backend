export class StoredRefreshTokenProjection {
  /** User UUID */
  userId: string
  /** User email */
  email: string
  /** Primary role name */
  role: string
  /** Whether the user account is active */
  isActive: boolean
  /** When the token was revoked (null if still valid) */
  revokedAt: Date | null
  /** When the token expires */
  expiresAt: Date
}
