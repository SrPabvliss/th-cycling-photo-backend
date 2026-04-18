export interface CreateRefreshTokenPayload {
  tokenHash: string
  userId: string
  expiresAt: Date
  ipAddress?: string | null
  userAgent?: string | null
}
