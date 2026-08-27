import { AppException } from '@shared/domain'
import { TenantContract } from './tenant-contract.entity'

describe('TenantContract', () => {
  const now = new Date('2026-08-23T12:00:00Z')
  const later = new Date('2026-09-23T12:00:00Z')

  const pending = () =>
    TenantContract.rehydrate({
      id: 'contract-1',
      userId: 'user-1',
      tenantId: null,
      commercialName: 'Fotos los Andes',
      eventsTotal: 1,
      photosPerEvent: 600,
      status: 'pending',
      validUntil: later,
      termsVersion: '2026-08-23',
      acceptedAt: null,
      revokedAt: null,
    })

  it('accepts for the account it names', () => {
    expect(() => pending().assertAcceptableBy('user-1', true, now)).not.toThrow()
  })

  it('refuses an account it does not name', () => {
    expect(() => pending().assertAcceptableBy('someone-else', true, now)).toThrow(AppException)
  })

  it('refuses an unverified email', () => {
    expect(() => pending().assertAcceptableBy('user-1', false, now)).toThrow(AppException)
  })

  it('refuses once the validity date has passed', () => {
    const past = new Date('2026-10-23T12:00:00Z')
    expect(() => pending().assertAcceptableBy('user-1', true, past)).toThrow(AppException)
  })

  it('refuses a contract that was already accepted', () => {
    const accepted = TenantContract.rehydrate({
      id: 'contract-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      commercialName: 'Fotos los Andes',
      eventsTotal: 1,
      photosPerEvent: 600,
      status: 'accepted',
      validUntil: later,
      termsVersion: '2026-08-23',
      acceptedAt: now,
      revokedAt: null,
    })
    expect(() => accepted.assertAcceptableBy('user-1', true, now)).toThrow(AppException)
  })

  it('refuses a revoked contract', () => {
    const revoked = TenantContract.rehydrate({
      id: 'contract-1',
      userId: 'user-1',
      tenantId: null,
      commercialName: 'Fotos los Andes',
      eventsTotal: 1,
      photosPerEvent: 600,
      status: 'revoked',
      validUntil: later,
      termsVersion: '2026-08-23',
      acceptedAt: null,
      revokedAt: now,
    })
    expect(() => revoked.assertAcceptableBy('user-1', true, now)).toThrow(AppException)
  })

  describe('assertRevocable', () => {
    const withStatus = (status: 'pending' | 'accepted' | 'revoked' | 'expired') =>
      TenantContract.rehydrate({
        id: 'contract-1',
        userId: 'user-1',
        tenantId: null,
        commercialName: 'Fotos los Andes',
        eventsTotal: 1,
        photosPerEvent: 600,
        status,
        validUntil: later,
        termsVersion: '2026-08-23',
        acceptedAt: status === 'accepted' ? now : null,
        revokedAt: status === 'revoked' ? now : null,
      })

    it('allows a pending contract', () => {
      expect(() => withStatus('pending').assertRevocable()).not.toThrow()
    })

    it('refuses an accepted contract', () => {
      expect(() => withStatus('accepted').assertRevocable()).toThrow(AppException)
    })

    it('refuses an already revoked contract', () => {
      expect(() => withStatus('revoked').assertRevocable()).toThrow(AppException)
    })

    it('refuses an expired contract', () => {
      expect(() => withStatus('expired').assertRevocable()).toThrow(AppException)
    })
  })

  describe('assertResendable', () => {
    const withValidUntil = (validUntil: Date) =>
      TenantContract.rehydrate({
        id: 'contract-1',
        userId: 'user-1',
        tenantId: null,
        commercialName: 'Fotos los Andes',
        eventsTotal: 1,
        photosPerEvent: 600,
        status: 'pending',
        validUntil,
        termsVersion: '2026-08-23',
        acceptedAt: null,
        revokedAt: null,
      })

    it('allows a pending contract that is still within its validity date', () => {
      expect(() => withValidUntil(later).assertResendable(now)).not.toThrow()
    })

    it('refuses a pending contract whose validity date already passed', () => {
      const past = new Date('2026-08-01T12:00:00Z')
      expect(() => withValidUntil(past).assertResendable(now)).toThrow(AppException)
    })

    it('refuses a non-pending contract before even checking validity', () => {
      const accepted = TenantContract.rehydrate({
        id: 'contract-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        commercialName: 'Fotos los Andes',
        eventsTotal: 1,
        photosPerEvent: 600,
        status: 'accepted',
        validUntil: later,
        termsVersion: '2026-08-23',
        acceptedAt: now,
        revokedAt: null,
      })
      expect(() => accepted.assertResendable(now)).toThrow(AppException)
    })
  })
})
