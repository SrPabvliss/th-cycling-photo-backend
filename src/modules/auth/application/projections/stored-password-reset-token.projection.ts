export class StoredPasswordResetTokenProjection {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
  isActive: boolean
  email: string
  firstName: string | null
}
