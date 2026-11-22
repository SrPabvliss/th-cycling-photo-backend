import { ageOn, isBirthdayOn, isMinorOn } from './age.utils'

const day = (dateOnly: string) => new Date(`${dateOnly}T00:00:00.000Z`)

describe('age utils', () => {
  it('counts whole years and turns a year older on the birthday', () => {
    expect(ageOn(day('2008-11-22'), '2026-11-21')).toBe(17)
    expect(ageOn(day('2008-11-22'), '2026-11-22')).toBe(18)
  })

  it('treats a missing birth date as not a minor', () => {
    expect(isMinorOn(null, '2026-11-22')).toBe(false)
    expect(isMinorOn(day('2010-01-01'), '2026-11-22')).toBe(true)
    expect(isMinorOn(day('2000-01-01'), '2026-11-22')).toBe(false)
  })

  it('matches the birthday by month and day', () => {
    expect(isBirthdayOn(day('1990-12-24'), '2026-12-24')).toBe(true)
    expect(isBirthdayOn(day('1990-12-24'), '2026-12-25')).toBe(false)
  })

  it('celebrates 29 February on 28 February in common years only', () => {
    expect(isBirthdayOn(day('2000-02-29'), '2027-02-28')).toBe(true)
    expect(isBirthdayOn(day('2000-02-29'), '2028-02-28')).toBe(false)
    expect(isBirthdayOn(day('2000-02-29'), '2028-02-29')).toBe(true)
  })
})
