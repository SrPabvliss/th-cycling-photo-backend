export class AuthCredentialsProjection {
  /** User UUID */
  id: string
  /** User email */
  email: string
  /** User first name */
  firstName: string | null
  /** Bcrypt password hash */
  passwordHash: string
  /** Whether the account is active */
  isActive: boolean
  /** Whether the account is an emergency-access account, excluded from email changes */
  isProtected: boolean
}
