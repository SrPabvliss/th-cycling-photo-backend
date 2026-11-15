import { AppException } from '@shared/domain'
import { BillingIdType, type BillingIdTypeValue } from '../value-objects/billing-id-type.vo'
import { BillingAccount } from './billing-account.entity'

describe('BillingAccount', () => {
  const create = (overrides: Partial<Parameters<typeof BillingAccount.create>[0]> = {}) =>
    BillingAccount.create({
      userId: 'user-1',
      idType: BillingIdType.NATIONAL_ID,
      idNumber: '1710034065',
      legalName: 'Juan Pérez',
      email: 'juan@correo.com',
      address: null,
      isDefault: false,
      ...overrides,
    })

  const messageKeyOf = (action: () => unknown) => {
    try {
      action()
    } catch (error) {
      return error instanceof AppException ? error.messageKey : 'not an AppException'
    }
    return 'no error'
  }

  it('normalizes a passport to uppercase letters and digits', () => {
    const account = create({ idType: BillingIdType.PASSPORT, idNumber: 'ab-123 45' })

    expect(account.idNumber).toBe('AB12345')
  })

  it.each<[BillingIdTypeValue, string]>([
    [BillingIdType.NATIONAL_ID, '171003406'],
    [BillingIdType.NATIONAL_ID, '17100340651'],
    [BillingIdType.RUC, '1710034065'],
    [BillingIdType.PASSPORT, 'A'.repeat(21)],
    [BillingIdType.PASSPORT, 'ÑANDÚ1'],
  ])('refuses a malformed %s number %s', (idType, idNumber) => {
    expect(messageKeyOf(() => create({ idType, idNumber }))).toBe(
      'billing.identification_malformed',
    )
  })

  it('accepts a thirteen digit RUC', () => {
    expect(create({ idType: BillingIdType.RUC, idNumber: '1790012345001' }).idNumber).toBe(
      '1790012345001',
    )
  })

  it.each(['', '   ', 'Juan\nPérez', 'x'.repeat(301)])('refuses the legal name %j', (legalName) => {
    expect(messageKeyOf(() => create({ legalName }))).toBe('billing.legal_name_invalid')
  })

  it('trims the legal name', () => {
    expect(create({ legalName: '  Ciclismo Andes S.A.  ' }).legalName).toBe('Ciclismo Andes S.A.')
  })

  it('stores a blank address as no address', () => {
    expect(create({ address: '   ' }).address).toBeNull()
  })

  it('refuses an address on more than one line', () => {
    expect(messageKeyOf(() => create({ address: 'Av. Amazonas\nQuito' }))).toBe(
      'billing.address_invalid',
    )
  })

  it('trims and lowercases the email', () => {
    expect(create({ email: '  Juan@Correo.COM ' }).email).toBe('juan@correo.com')
  })

  it('applies only the changes it is given and keeps identity and default flag', () => {
    const account = create({ isDefault: true, address: 'Av. Amazonas' })
    const id = account.id

    account.update({ legalName: '  Juana Pérez ', email: ' JUANA@Correo.com ' })

    expect(account.id).toBe(id)
    expect(account.isDefault).toBe(true)
    expect(account.legalName).toBe('Juana Pérez')
    expect(account.email).toBe('juana@correo.com')
    expect(account.idNumber).toBe('1710034065')
    expect(account.address).toBe('Av. Amazonas')
  })

  it('reports whether an update changed the identification', () => {
    const account = create()

    expect(account.update({ legalName: 'Otro' }).identificationChanged).toBe(false)
    expect(
      account.update({ idType: BillingIdType.NATIONAL_ID, idNumber: ' 1710034065 ' })
        .identificationChanged,
    ).toBe(false)
    expect(
      account.update({ idType: BillingIdType.RUC, idNumber: '1790012345001' })
        .identificationChanged,
    ).toBe(true)
    expect(account.idType).toBe(BillingIdType.RUC)
  })

  it('clears the address on null or blank and leaves it alone when absent', () => {
    const account = create({ address: 'Av. Amazonas' })

    account.update({})
    expect(account.address).toBe('Av. Amazonas')

    account.update({ address: null })
    expect(account.address).toBeNull()

    account.update({ address: 'Calle 2' })
    account.update({ address: '   ' })
    expect(account.address).toBeNull()
  })

  it('refuses an update that would leave the account malformed, changing nothing', () => {
    const account = create()

    expect(
      messageKeyOf(() =>
        account.update({ legalName: 'Nombre Nuevo', idType: BillingIdType.RUC, idNumber: '123' }),
      ),
    ).toBe('billing.identification_malformed')
    expect(messageKeyOf(() => account.update({ legalName: '   ' }))).toBe(
      'billing.legal_name_invalid',
    )
    expect(account.legalName).toBe('Juan Pérez')
    expect(account.idNumber).toBe('1710034065')
  })

  it('marks the account deleted without losing its data', () => {
    const account = create()

    account.markDeleted()

    expect(account.deletedAt).toBeInstanceOf(Date)
    expect(account.idNumber).toBe('1710034065')
  })
})
