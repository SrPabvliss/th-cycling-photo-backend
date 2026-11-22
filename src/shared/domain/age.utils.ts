import { toCalendarDateOnly } from './ecuador-date.utils'

export const ADULT_AGE = 18

const parts = (dateOnly: string): [number, number, number] =>
  dateOnly.split('-').map(Number) as [number, number, number]

/** Whole years on a calendar day (`YYYY-MM-DD`) for a `@db.Date` birth date. */
export function ageOn(birthDate: Date, today: string): number {
  const [by, bm, bd] = parts(toCalendarDateOnly(birthDate))
  const [ty, tm, td] = parts(today)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

/** A missing birth date is not treated as a minor: minors always register with one. */
export function isMinorOn(birthDate: Date | null, today: string): boolean {
  return birthDate !== null && ageOn(birthDate, today) < ADULT_AGE
}

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** Whether the birthday falls on that day. 29 February birthdays are celebrated on 28 February in common years. */
export function isBirthdayOn(birthDate: Date, today: string): boolean {
  const [, bm, bd] = parts(toCalendarDateOnly(birthDate))
  const [ty, tm, td] = parts(today)
  if (bm === tm && bd === td) return true
  return bm === 2 && bd === 29 && !isLeapYear(ty) && tm === 2 && td === 28
}
