import { endOfDayInEcuador, startOfDayInEcuador, toEcuadorDateOnly } from './ecuador-date.utils'

describe('endOfDayInEcuador', () => {
  it('resolves the chosen calendar day last instant in UTC-5, not UTC midnight', () => {
    const result = endOfDayInEcuador('2026-12-31')

    expect(result.toISOString()).toBe('2027-01-01T04:59:59.999Z')
  })
})

describe('startOfDayInEcuador', () => {
  it('resolves the chosen calendar day first instant in UTC-5, not UTC midnight', () => {
    const result = startOfDayInEcuador('2026-08-23')

    expect(result.toISOString()).toBe('2026-08-23T05:00:00.000Z')
  })

  it('excludes the previous evening, unlike a plain UTC parse of the same date string', () => {
    const start = startOfDayInEcuador('2026-08-20')
    const eveningBefore = new Date('2026-08-19T19:00:00.000-05:00')

    expect(eveningBefore < start).toBe(true)
  })
})

describe('toEcuadorDateOnly', () => {
  it('round-trips a date picked in the admin UI back to the same calendar day', () => {
    const picked = endOfDayInEcuador('2026-08-31')

    expect(toEcuadorDateOnly(picked)).toBe('2026-08-31')
  })

  it('reads a raw UTC instant as its Ecuador calendar day', () => {
    expect(toEcuadorDateOnly(new Date('2026-01-01T02:00:00.000Z'))).toBe('2025-12-31')
  })
})
