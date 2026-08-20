import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateMyProfileDto } from './update-my-profile.dto'

describe('UpdateMyProfileDto', () => {
  it('rejects countryId: null', async () => {
    const dto = plainToInstance(UpdateMyProfileDto, { countryId: null })

    const errors = await validate(dto)

    expect(errors.some((error) => error.property === 'countryId')).toBe(true)
  })

  it('accepts a missing countryId', async () => {
    const dto = plainToInstance(UpdateMyProfileDto, {})

    const errors = await validate(dto)

    expect(errors.some((error) => error.property === 'countryId')).toBe(false)
  })

  it('accepts a valid countryId', async () => {
    const dto = plainToInstance(UpdateMyProfileDto, { countryId: 63 })

    const errors = await validate(dto)

    expect(errors.some((error) => error.property === 'countryId')).toBe(false)
  })
})
