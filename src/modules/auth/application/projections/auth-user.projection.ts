export class AuthUserProjection {
  /** User UUID */
  id: string
  /** User email */
  email: string
  /** Bcrypt password hash */
  passwordHash: string
  /** Whether the account is active */
  isActive: boolean
  /** Primary role name */
  role: string
}
