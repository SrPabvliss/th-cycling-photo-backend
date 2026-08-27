import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateEventConfigurationDto } from './update-event-configuration.dto'

const check = async (raw: unknown) =>
  validate(plainToInstance(UpdateEventConfigurationDto, raw), { whitelist: true })

describe('UpdateEventConfigurationDto', () => {
  it('rejects a public name of fewer than three characters', async () => {
    expect(await check({ publicName: 'A' })).not.toHaveLength(0)
  })

  it('trims the public name before measuring it', async () => {
    expect(await check({ publicName: '  A  ' })).not.toHaveLength(0)

    const dto = plainToInstance(UpdateEventConfigurationDto, { publicName: '  Foto Andes  ' })
    expect(await validate(dto, { whitelist: true })).toHaveLength(0)
    expect(dto.publicName).toBe('Foto Andes')
  })

  it('leaves a null public name alone', async () => {
    expect(await check({ publicName: null })).toHaveLength(0)
  })

  it('takes a payout list of kept event rows without any field validation', async () => {
    expect(
      await check({
        payoutMethods: [
          { source: 'event', id: '11111111-1111-4111-8111-111111111111' },
          { source: 'event', id: '22222222-2222-4222-8222-222222222222' },
        ],
      }),
    ).toHaveLength(0)
  })

  it('still holds a genuinely new bank row to the tightened rules', async () => {
    expect(
      await check({
        payoutMethods: [
          {
            source: 'new',
            provider: 'bank_transfer',
            bankName: 'Banco Pichincha',
            accountNumber: '2201-234567',
            accountType: 'ahorros',
            accountHolder: 'Juan Perez',
            holderIdentification: '1801234567',
          },
        ],
      }),
    ).not.toHaveLength(0)
  })
})
