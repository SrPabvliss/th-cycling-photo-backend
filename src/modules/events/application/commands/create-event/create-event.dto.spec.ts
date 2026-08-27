import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import {
  EventConfigurationSelectionDto,
  EventPayoutSelectionDto,
  toEventPayoutSelection,
} from './create-event.dto'

const check = async (raw: unknown) =>
  validate(plainToInstance(EventPayoutSelectionDto, raw), { whitelist: true })

const checkConfiguration = async (raw: unknown) =>
  validate(plainToInstance(EventConfigurationSelectionDto, raw), { whitelist: true })

const bankTransfer = (overrides: Record<string, unknown> = {}) => ({
  source: 'new',
  provider: 'bank_transfer',
  bankName: 'Banco Pichincha',
  accountNumber: '2100458899',
  accountType: 'ahorros',
  accountHolder: 'Andres Cepeda Mora',
  holderIdentification: '1712345678',
  ...overrides,
})

describe('EventPayoutSelectionDto', () => {
  it('accepts a profile entry with a uuid', async () => {
    expect(
      await check({ source: 'profile', id: '11111111-1111-4111-8111-111111111111' }),
    ).toHaveLength(0)
  })

  it('rejects a profile entry without an id', async () => {
    expect(await check({ source: 'profile' })).not.toHaveLength(0)
  })

  it('accepts an event entry with a uuid and no other field', async () => {
    expect(
      await check({ source: 'event', id: '33333333-3333-4333-8333-333333333333' }),
    ).toHaveLength(0)
  })

  it('rejects an event entry without an id', async () => {
    expect(await check({ source: 'event' })).not.toHaveLength(0)
  })

  it('holds an event entry to none of the bank field rules', async () => {
    expect(
      await check({
        source: 'event',
        id: '33333333-3333-4333-8333-333333333333',
        accountNumber: '2',
        accountType: 'whatever',
        holderIdentification: 'x',
      }),
    ).toHaveLength(0)
  })

  it('maps an event entry to a keep-this-row selection', () => {
    const dto = plainToInstance(EventPayoutSelectionDto, {
      source: 'event',
      id: '33333333-3333-4333-8333-333333333333',
    })

    expect(toEventPayoutSelection(dto)).toEqual({
      source: 'event',
      id: '33333333-3333-4333-8333-333333333333',
    })
  })

  it('accepts a new payphone entry with a phone', async () => {
    expect(
      await check({ source: 'new', provider: 'payphone', phone: '+593987654321' }),
    ).toHaveLength(0)
  })

  it('rejects a new bank transfer missing the holder identification', async () => {
    expect(
      await check({
        source: 'new',
        provider: 'bank_transfer',
        bankName: 'Banco Pichincha',
        accountNumber: '2100458899',
        accountType: 'Ahorros',
        accountHolder: 'Andres Cepeda Mora',
      }),
    ).not.toHaveLength(0)
  })

  it('rejects an account number longer than the column', async () => {
    expect(
      await check({
        source: 'new',
        provider: 'bank_transfer',
        bankName: 'Banco Pichincha',
        accountNumber: '1'.repeat(51),
        accountType: 'Ahorros',
        accountHolder: 'Andres Cepeda Mora',
        holderIdentification: '1712345678',
      }),
    ).not.toHaveLength(0)
  })
  it('accepts a complete new bank transfer', async () => {
    expect(await check(bankTransfer())).toHaveLength(0)
  })

  it('rejects a bank name of fewer than three characters', async () => {
    expect(await check(bankTransfer({ bankName: 'Ba' }))).not.toHaveLength(0)
  })

  it('rejects a bank name that is only whitespace padding', async () => {
    expect(await check(bankTransfer({ bankName: '  B  ' }))).not.toHaveLength(0)
  })

  it('rejects an account number with fewer than five digits', async () => {
    expect(await check(bankTransfer({ accountNumber: '2100' }))).not.toHaveLength(0)
  })

  it('rejects an account number that is not only digits', async () => {
    expect(await check(bankTransfer({ accountNumber: '2100-4588' }))).not.toHaveLength(0)
  })

  it('rejects an account type outside the closed set', async () => {
    expect(await check(bankTransfer({ accountType: 'plazo fijo' }))).not.toHaveLength(0)
  })

  it('normalises the account type casing before checking the closed set', async () => {
    const dto = plainToInstance(EventPayoutSelectionDto, bankTransfer({ accountType: 'Ahorros' }))
    expect(await validate(dto, { whitelist: true })).toHaveLength(0)
    expect(dto.accountType).toBe('ahorros')
  })

  it('rejects an account holder of fewer than three characters', async () => {
    expect(await check(bankTransfer({ accountHolder: 'An' }))).not.toHaveLength(0)
  })

  it('takes a ten digit cedula and a thirteen digit ruc as the holder identification', async () => {
    expect(await check(bankTransfer({ holderIdentification: '1712345678' }))).toHaveLength(0)
    expect(await check(bankTransfer({ holderIdentification: '1712345678001' }))).toHaveLength(0)
  })

  it('rejects a holder identification of any other length', async () => {
    expect(await check(bankTransfer({ holderIdentification: '171234567' }))).not.toHaveLength(0)
    expect(await check(bankTransfer({ holderIdentification: '17123456780' }))).not.toHaveLength(0)
  })

  it('rejects a holder identification that is not only digits', async () => {
    expect(await check(bankTransfer({ holderIdentification: '17123456-8' }))).not.toHaveLength(0)
  })
})

describe('EventConfigurationSelectionDto', () => {
  it('rejects a public name of fewer than three characters', async () => {
    expect(await checkConfiguration({ publicName: 'An' })).not.toHaveLength(0)
  })

  it('trims the public name before measuring it', async () => {
    expect(await checkConfiguration({ publicName: '  An  ' })).not.toHaveLength(0)

    const dto = plainToInstance(EventConfigurationSelectionDto, {
      publicName: '  Andes Bike Media  ',
    })
    expect(await validate(dto, { whitelist: true })).toHaveLength(0)
    expect(dto.publicName).toBe('Andes Bike Media')
  })

  it('leaves a null public name alone', async () => {
    expect(await checkConfiguration({ publicName: null })).toHaveLength(0)
  })
})
