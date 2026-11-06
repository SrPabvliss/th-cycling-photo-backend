import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateEventDto } from '../update-event/update-event.dto'
import { UpdateEventConfigurationDto } from '../update-event-configuration/update-event-configuration.dto'
import {
  CreateEventDto,
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

  it.each([
    ['absent', {}],
    ['null', { watermarkStorageKey: null }],
    ['empty', { watermarkStorageKey: '' }],
  ])('accepts a %s watermark on create and on the configuration patch', async (_, raw) => {
    expect(await checkConfiguration(raw)).toHaveLength(0)
    expect(
      await validate(plainToInstance(UpdateEventConfigurationDto, raw), { whitelist: true }),
    ).toHaveLength(0)
  })

  it('reads an empty watermark as no watermark', () => {
    expect(
      plainToInstance(EventConfigurationSelectionDto, { watermarkStorageKey: '' })
        .watermarkStorageKey,
    ).toBeNull()
  })
})

describe('event dates', () => {
  const dateErrors = async (cls: new () => object, raw: Record<string, unknown>) => {
    const errors = await validate(plainToInstance(cls, raw), { whitelist: true })
    return errors
      .filter((e) => e.property === 'startDate' || e.property === 'endDate')
      .map((e) => e.property)
  }

  const base = { name: 'Vuelta al Cotopaxi', eventTypeId: 1 }

  it('requires both dates on create', async () => {
    expect(await dateErrors(CreateEventDto, base)).toEqual(['startDate', 'endDate'])
  })

  it.each([null, '', 0, '1970-01-01'])('rejects %p as a create date', async (value) => {
    expect(await dateErrors(CreateEventDto, { ...base, startDate: value, endDate: value })).toEqual(
      ['startDate', 'endDate'],
    )
  })

  it('accepts real dates on create', async () => {
    expect(
      await dateErrors(CreateEventDto, {
        ...base,
        startDate: '2026-06-15T00:00:00.000Z',
        endDate: '2026-06-16T00:00:00.000Z',
      }),
    ).toEqual([])
  })

  it('keys the floor message by the field so the error lands on it', async () => {
    const errors = await validate(
      plainToInstance(CreateEventDto, { ...base, startDate: 0, endDate: '2026-06-16' }),
    )
    const message = Object.values(errors.find((e) => e.property === 'startDate')?.constraints ?? {})
    expect(message[0]?.split(' ')[0]).toBe('startDate')
  })

  it('leaves dates optional on update but still refuses the epoch', async () => {
    expect(await dateErrors(UpdateEventDto, {})).toEqual([])
    expect(await dateErrors(UpdateEventDto, { startDate: '1970-01-01' })).toEqual(['startDate'])
  })
})
