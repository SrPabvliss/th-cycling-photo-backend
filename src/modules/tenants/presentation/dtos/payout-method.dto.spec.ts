import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreatePayoutMethodDto, UpdatePayoutMethodDto } from './payout-method.dto'

const bankFields = (overrides: Record<string, unknown> = {}) => ({
  bankName: 'Banco Pichincha',
  accountNumber: '2201234567',
  accountType: 'ahorros',
  accountHolder: 'Juan Perez',
  holderIdentification: '1801234567',
  password: 'secret-password',
  ...overrides,
})

const checkCreate = async (raw: Record<string, unknown>) =>
  validate(plainToInstance(CreatePayoutMethodDto, { provider: 'bank_transfer', ...raw }), {
    whitelist: true,
  })

const checkUpdate = async (raw: Record<string, unknown>) =>
  validate(plainToInstance(UpdatePayoutMethodDto, raw), { whitelist: true })

describe('CreatePayoutMethodDto', () => {
  it('accepts a complete bank transfer', async () => {
    expect(await checkCreate(bankFields())).toHaveLength(0)
  })

  it('accepts a payphone entry that carries no bank fields', async () => {
    expect(
      await checkCreate({ provider: 'payphone', phone: '+593987654321', password: 'secret' }),
    ).toHaveLength(0)
  })

  it('rejects a bank name of fewer than three characters', async () => {
    expect(await checkCreate(bankFields({ bankName: 'B' }))).not.toHaveLength(0)
  })

  it('rejects an account number with fewer than five digits', async () => {
    expect(await checkCreate(bankFields({ accountNumber: '2201' }))).not.toHaveLength(0)
  })

  it('rejects an account number that is not only digits', async () => {
    expect(await checkCreate(bankFields({ accountNumber: '2201 234 567' }))).not.toHaveLength(0)
  })

  it('rejects an account type outside the closed set', async () => {
    expect(await checkCreate(bankFields({ accountType: 'x' }))).not.toHaveLength(0)
  })

  it('normalises the account type casing before checking the closed set', async () => {
    const dto = plainToInstance(CreatePayoutMethodDto, {
      provider: 'bank_transfer',
      ...bankFields({ accountType: 'Corriente' }),
    })
    expect(await validate(dto, { whitelist: true })).toHaveLength(0)
    expect(dto.accountType).toBe('corriente')
  })

  it('rejects an account holder of fewer than three characters', async () => {
    expect(await checkCreate(bankFields({ accountHolder: 'Jo' }))).not.toHaveLength(0)
  })

  it('takes a ten digit cedula and a thirteen digit ruc as the holder identification', async () => {
    expect(await checkCreate(bankFields({ holderIdentification: '1801234567' }))).toHaveLength(0)
    expect(await checkCreate(bankFields({ holderIdentification: '1801234567001' }))).toHaveLength(0)
  })

  it('rejects a holder identification of any other length', async () => {
    expect(await checkCreate(bankFields({ holderIdentification: '180123456' }))).not.toHaveLength(0)
    expect(await checkCreate(bankFields({ holderIdentification: '18012345670' }))).not.toHaveLength(
      0,
    )
  })
})

describe('UpdatePayoutMethodDto', () => {
  it('accepts a partial update that only touches the account holder', async () => {
    expect(
      await checkUpdate({ accountHolder: 'Maria Perez', password: 'secret-password' }),
    ).toHaveLength(0)
  })

  it('applies the same bank rules as the create shape', async () => {
    expect(await checkUpdate(bankFields({ accountNumber: '22' }))).not.toHaveLength(0)
    expect(await checkUpdate(bankFields({ accountType: 'x' }))).not.toHaveLength(0)
    expect(await checkUpdate(bankFields({ holderIdentification: '18012' }))).not.toHaveLength(0)
    expect(await checkUpdate(bankFields({ bankName: 'B' }))).not.toHaveLength(0)
    expect(await checkUpdate(bankFields({ accountHolder: 'Jo' }))).not.toHaveLength(0)
  })
})
