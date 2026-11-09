import { EventBankAccountService } from './event-bank-account.service'

const bank = (accountNumber: string, isActive = true) =>
  ({
    provider: 'bank_transfer',
    isActive,
    bankName: 'Banco Pichincha',
    accountNumber,
    accountType: 'savings',
    accountHolder: 'FRANKLIN VILLACRES',
    holderIdentification: '1804...',
  }) as never

const payphone = () => ({ provider: 'payphone', isActive: true }) as never

describe('EventBankAccountService', () => {
  const event = { tenantId: 'tenant-1' }

  function build(eventMethods: unknown[], tenantMethods: unknown[]) {
    return new EventBankAccountService(
      { findByEventId: jest.fn().mockResolvedValue(eventMethods) } as never,
      { findByTenantId: jest.fn().mockResolvedValue(tenantMethods) } as never,
      { findById: jest.fn().mockResolvedValue(event) } as never,
    )
  }

  it('prefers the account frozen on the event', async () => {
    const service = build([bank('111')], [bank('999')])

    await expect(service.resolveForEvent('event-1')).resolves.toMatchObject({
      accountNumber: '111',
    })
  })

  it('falls back to the tenant account for events frozen before payouts were copied', async () => {
    const service = build([], [bank('999')])

    await expect(service.resolveForEvent('event-1')).resolves.toMatchObject({
      accountNumber: '999',
    })
  })

  it('ignores inactive and non-bank methods on both levels', async () => {
    const service = build([payphone(), bank('111', false)], [payphone(), bank('222', false)])

    await expect(service.resolveForEvent('event-1')).resolves.toBeNull()
  })

  it('returns null when the event no longer exists rather than guessing an account', async () => {
    const service = new EventBankAccountService(
      { findByEventId: jest.fn().mockResolvedValue([]) } as never,
      { findByTenantId: jest.fn() } as never,
      { findById: jest.fn().mockResolvedValue(null) } as never,
    )

    await expect(service.resolveForEvent('gone')).resolves.toBeNull()
  })
})
