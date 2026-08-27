import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { TenantPayoutMethod } from '@tenants/domain/entities/tenant-payout-method.entity'
import { PayoutProvider } from '@tenants/domain/value-objects/payout-provider.vo'
import { EventPayoutMethod } from './event-payout-method.entity'

describe('EventPayoutMethod', () => {
  const eventId = crypto.randomUUID()
  const tenantId = crypto.randomUUID()

  it('copies payphone values and records provenance', () => {
    const source = TenantPayoutMethod.createPayphoneSplit(tenantId, '0991234567', null)

    const copy = EventPayoutMethod.copyFrom(eventId, source)

    expect(copy.provider).toBe('payphone')
    expect(copy.receiverIdentifier).toBe('0991234567')
    expect(copy.sourcePayoutMethodId).toBe(source.id)
    expect(copy.eventId).toBe(eventId)
  })

  it('does not track later edits to its source', () => {
    const source = TenantPayoutMethod.createBankTransfer(
      tenantId,
      {
        bankName: 'Pichincha',
        accountNumber: '2100112233',
        accountType: 'savings',
        accountHolder: 'Ana Perez',
        holderIdentification: '1804567890',
      },
      null,
    )
    const copy = EventPayoutMethod.copyFrom(eventId, source)

    source.updateBankDetails({
      bankName: 'Guayaquil',
      accountNumber: '9999999999',
      accountType: 'checking',
      accountHolder: 'Otra Persona',
      holderIdentification: '1800000000',
    })

    expect(copy.bankName).toBe('Pichincha')
    expect(copy.accountNumber).toBe('2100112233')
  })
})

describe('EventPayoutMethod standalone constructors', () => {
  it('builds a payphone split receiver with no tenant source', () => {
    const method = EventPayoutMethod.createPayphoneSplit('event-1', '+593987654321')

    expect(method.eventId).toBe('event-1')
    expect(method.provider).toBe(PayoutProvider.PAYPHONE)
    expect(method.mode).toBe(PaymentMode.SPLIT_RECEIVER)
    expect(method.receiverIdentifier).toBe('+593987654321')
    expect(method.sourcePayoutMethodId).toBeNull()
    expect(method.isActive).toBe(true)
    expect(method.bankName).toBeNull()
  })

  it('builds a bank transfer with no tenant source', () => {
    const method = EventPayoutMethod.createBankTransfer('event-1', {
      bankName: 'Banco Pichincha',
      accountNumber: '2100458899',
      accountType: 'Ahorros',
      accountHolder: 'Andres Cepeda Mora',
      holderIdentification: '1712345678',
    })

    expect(method.provider).toBe(PayoutProvider.BANK_TRANSFER)
    expect(method.mode).toBeNull()
    expect(method.receiverIdentifier).toBeNull()
    expect(method.bankName).toBe('Banco Pichincha')
    expect(method.holderIdentification).toBe('1712345678')
    expect(method.sourcePayoutMethodId).toBeNull()
  })
})
