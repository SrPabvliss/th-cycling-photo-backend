export class EmailVerificationStatusProjection {
  /** Whether there is a usable code waiting to be redeemed */
  pending: boolean
  /** Whether the latest code exists but is past its expiry, still tracked so the pending change isn't lost */
  expired: boolean
  /** 'verify_current' | 'change_email', or null when there is no code to report */
  purpose: string | null
  /** Destination address, masked (e.g. 'ej***@gmail.com') */
  maskedTargetEmail: string | null
  /** When the pending code stops being valid */
  expiresAt: Date | null
  /** Redemption attempts left before the code burns itself */
  attemptsRemaining: number | null
}
