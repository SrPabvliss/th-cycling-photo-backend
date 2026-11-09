import { daysUntil, resolveInvitationState, resolveOrganizerState } from './organizer-state'

const NOW = new Date('2026-08-24T12:00:00Z')

describe('resolveOrganizerState', () => {
  it('is no_quota when nothing is available, whatever the expiry says', () => {
    expect(resolveOrganizerState({ available: 0, nextExpiry: new Date('2026-12-31') }, NOW)).toBe(
      'no_quota',
    )
  })

  it('is no_quota when there is no valid contract at all', () => {
    expect(resolveOrganizerState({ available: 0, nextExpiry: null }, NOW)).toBe('no_quota')
  })

  it('is expiring when capacity remains and the nearest expiry is inside the window', () => {
    expect(resolveOrganizerState({ available: 3, nextExpiry: new Date('2026-09-12') }, NOW)).toBe(
      'expiring',
    )
  })

  it('is expiring on the last day of the window', () => {
    expect(resolveOrganizerState({ available: 1, nextExpiry: new Date('2026-09-23') }, NOW)).toBe(
      'expiring',
    )
  })

  it('is activo one day past the window', () => {
    expect(resolveOrganizerState({ available: 1, nextExpiry: new Date('2026-09-25') }, NOW)).toBe(
      'active',
    )
  })
})

describe('daysUntil', () => {
  it('rounds a partial day up, so a same-week expiry never reads as zero', () => {
    expect(daysUntil(new Date('2026-09-23'), NOW)).toBe(30)
  })

  it('is negative once the target is behind us', () => {
    expect(daysUntil(new Date('2026-08-20'), NOW)).toBeLessThan(0)
  })
})

describe('resolveInvitationState', () => {
  it('is revocada regardless of the date', () => {
    expect(
      resolveInvitationState({ status: 'revoked', validUntil: new Date('2027-01-01') }, NOW),
    ).toBe('revoked')
  })

  it('is vencida when a pending contract is past its date', () => {
    expect(
      resolveInvitationState({ status: 'pending', validUntil: new Date('2026-07-31') }, NOW),
    ).toBe('expired')
  })

  it('is pendiente while the date holds', () => {
    expect(
      resolveInvitationState({ status: 'pending', validUntil: new Date('2026-09-20') }, NOW),
    ).toBe('pending')
  })
})
