// Ecuador does not observe DST, so its UTC offset is always -05:00.
const ECUADOR_UTC_OFFSET = '-05:00'
const ECUADOR_TIME_ZONE = 'America/Guayaquil'

export function endOfDayInEcuador(dateOnly: string): Date {
  return new Date(`${dateOnly}T23:59:59.999${ECUADOR_UTC_OFFSET}`)
}

export function startOfDayInEcuador(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000${ECUADOR_UTC_OFFSET}`)
}

const ecuadorDateOnlyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ECUADOR_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function toEcuadorDateOnly(date: Date): string {
  return ecuadorDateOnlyFormatter.format(date)
}
