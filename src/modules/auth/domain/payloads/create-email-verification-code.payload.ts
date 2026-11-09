export interface CreateEmailVerificationCodePayload {
  id: string
  userId: string
  purpose: string
  targetEmail: string
  codeHash: string
  expiresAt: Date
}
