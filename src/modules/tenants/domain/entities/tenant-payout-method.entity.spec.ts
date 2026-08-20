import { PaymentAccountStatus } from '@payments/domain/value-objects/payment-account-status.vo'
import { AppException } from '@shared/domain'
import { PayoutProvider } from '../value-objects/payout-provider.vo'
import { TenantPayoutMethod } from './tenant-payout-method.entity'

const bank = {
  bankName: 'Pichincha',
  accountNumber: '2100123456',
  accountType: 'ahorros',
  accountHolder: 'Juan Pérez',
  holderIdentification: '1804567890',
}

describe('TenantPayoutMethod.createPayphoneSplit', () => {
  it('starts pending and holds the receiver', () => {
    const method = TenantPayoutMethod.createPayphoneSplit('t1', '984112233', 'u1')

    expect(method.provider).toBe(PayoutProvider.PAYPHONE)
    expect(method.status).toBe(PaymentAccountStatus.PENDING)
    expect(method.receiverIdentifier).toBe('984112233')
    expect(method.isUsable).toBe(false)
  })
})

describe('TenantPayoutMethod.createBankTransfer', () => {
  it('is usable immediately and holds the bank details', () => {
    const method = TenantPayoutMethod.createBankTransfer('t1', bank, 'u1')

    expect(method.provider).toBe(PayoutProvider.BANK_TRANSFER)
    expect(method.accountNumber).toBe('2100123456')
    expect(method.isUsable).toBe(true)
  })
})

describe('TenantPayoutMethod.updateSplitReceiver', () => {
  it('returns to pending after the number changes', () => {
    const method = TenantPayoutMethod.createPayphoneSplit('t1', '984112233', 'u1')
    method.markVerified()

    method.updateSplitReceiver('984999888')

    expect(method.status).toBe(PaymentAccountStatus.PENDING)
    expect(method.verifiedAt).toBeNull()
  })
})

describe('TenantPayoutMethod.fromPersistence', () => {
  it('rejects a payphone row with no receiver', () => {
    expect(() =>
      TenantPayoutMethod.fromPersistence({
        id: 'm1',
        tenantId: 't1',
        provider: PayoutProvider.PAYPHONE,
        isActive: true,
        sortOrder: 0,
        mode: null,
        status: PaymentAccountStatus.VERIFIED,
        receiverIdentifier: null,
        credentialsEncrypted: null,
        verifiedAt: new Date(),
        bankName: null,
        accountNumber: null,
        accountType: null,
        accountHolder: null,
        holderIdentification: null,
        configuredById: null,
        createdAt: new Date(),
      }),
    ).toThrow(AppException)
  })

  it('rejects a bank transfer row with no account number', () => {
    expect(() =>
      TenantPayoutMethod.fromPersistence({
        id: 'm2',
        tenantId: 't1',
        provider: PayoutProvider.BANK_TRANSFER,
        isActive: true,
        sortOrder: 0,
        mode: null,
        status: PaymentAccountStatus.VERIFIED,
        receiverIdentifier: null,
        credentialsEncrypted: null,
        verifiedAt: null,
        bankName: 'Pichincha',
        accountNumber: null,
        accountType: 'ahorros',
        accountHolder: 'Juan Pérez',
        holderIdentification: '1804567890',
        configuredById: null,
        createdAt: new Date(),
      }),
    ).toThrow(AppException)
  })
})
