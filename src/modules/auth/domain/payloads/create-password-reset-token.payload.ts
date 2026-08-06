export interface CreatePasswordResetTokenPayload {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
}
