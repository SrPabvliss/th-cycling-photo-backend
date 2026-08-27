import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { IssueContractDto } from './issue-contract.dto'

const BASE = {
  ownerEmail: 'organizador@test.com',
  commercialName: 'Vuelta Ambato',
  eventsTotal: 1,
  photosPerEvent: 600,
}

describe('IssueContractDto', () => {
  it('turns a date-only validUntil into that day last instant in Ecuador time, not UTC midnight', async () => {
    const dto = plainToInstance(IssueContractDto, { ...BASE, validUntil: '2026-12-31' })

    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
    expect(dto.validUntil.toISOString()).toBe('2027-01-01T04:59:59.999Z')
  })

  it('rejects a validUntil that is not a valid date-only string', async () => {
    const dto = plainToInstance(IssueContractDto, { ...BASE, validUntil: 'not-a-date' })

    const errors = await validate(dto)

    expect(errors.some((error) => error.property === 'validUntil')).toBe(true)
  })
})
