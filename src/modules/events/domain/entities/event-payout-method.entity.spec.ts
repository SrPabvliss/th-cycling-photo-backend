import { TenantPayoutMethod } from '@tenants/domain/entities/tenant-payout-method.entity'
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
