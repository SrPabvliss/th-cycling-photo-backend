export class PendingEmailVerificationCodeProjection {
  /** Verification code UUID */
  id: string
  /** Owning user UUID */
  userId: string
  /** 'verify_current' | 'change_email' */
  purpose: string
  /** Address the code was sent to */
  targetEmail: string
  /** Hash of the 6-digit code */
  codeHash: string
  /** When the code stops being valid */
  expiresAt: Date
  /** When the code was consumed, or null if still pending */
  consumedAt: Date | null
  /** Number of redemption attempts so far */
  attempts: number
  /** When the code was generated */
  createdAt: Date
}
