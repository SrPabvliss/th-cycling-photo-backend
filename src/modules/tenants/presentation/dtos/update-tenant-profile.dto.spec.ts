import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateTenantProfileDto } from './update-tenant-profile.dto'

const check = async (raw: unknown) =>
  validate(plainToInstance(UpdateTenantProfileDto, raw), { whitelist: true })

describe('UpdateTenantProfileDto', () => {
  it('accepts a public name of three characters or more', async () => {
    expect(await check({ publicName: 'Foto Andes' })).toHaveLength(0)
  })

  it('rejects a public name of fewer than three characters', async () => {
    expect(await check({ publicName: 'A' })).not.toHaveLength(0)
  })

  it('trims the public name before measuring it', async () => {
    expect(await check({ publicName: '  A  ' })).not.toHaveLength(0)

    const dto = plainToInstance(UpdateTenantProfileDto, { publicName: '  Foto Andes  ' })
    expect(await validate(dto, { whitelist: true })).toHaveLength(0)
    expect(dto.publicName).toBe('Foto Andes')
  })

  it('leaves a null public name alone, which is how the screen clears it', async () => {
    expect(await check({ publicName: null })).toHaveLength(0)
  })

  it('leaves an update that only touches whatsapp alone', async () => {
    expect(await check({ whatsappNumber: '+593987654321' })).toHaveLength(0)
  })
})
