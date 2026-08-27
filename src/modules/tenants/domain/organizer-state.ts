export const EXPIRING_SOON_DAYS = 30

const MS_PER_DAY = 86_400_000

export type OrganizerState = 'active' | 'expiring' | 'no_quota'
export type InvitationState = 'pending' | 'expired' | 'revoked'

export function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY)
}

export function resolveOrganizerState(
  input: { available: number; nextExpiry: Date | null },
  now: Date,
): OrganizerState {
  if (input.available <= 0 || input.nextExpiry === null) return 'no_quota'
  return daysUntil(input.nextExpiry, now) <= EXPIRING_SOON_DAYS ? 'expiring' : 'active'
}

export function resolveInvitationState(
  input: { status: string; validUntil: Date },
  now: Date,
): InvitationState {
  if (input.status === 'revoked') return 'revoked'
  return input.validUntil.getTime() < now.getTime() ? 'expired' : 'pending'
}
