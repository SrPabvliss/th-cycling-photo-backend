import type { CdnTransformationPoint, YupanaOutboxEntry } from './ports'
import { YupanaUsageReport } from './yupana-usage-report'

const MS_PER_DAY = 86_400_000
const MS_PER_HOUR = 3_600_000

export interface CdnSubjectRef {
  photoId: string
  eventId: string
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

export class CdnTransformationDay {
  static readonly SETTLE_HOURS = 2
  static readonly MAX_DAYS_BACK = 90

  static subjectKey(kind: string, slug: string): string {
    return `${kind === 'asset' ? 'asset' : 'photo'}|${slug}`
  }

  static pendingDays(lastProcessed: string | null, firstDay: string | null, now: Date): string[] {
    const today = now.toISOString().slice(0, 10)
    const settledAt =
      Date.parse(`${today}T00:00:00Z`) + CdnTransformationDay.SETTLE_HOURS * MS_PER_HOUR
    const last = addDays(today, now.getTime() >= settledAt ? -1 : -2)
    const floor = addDays(today, -CdnTransformationDay.MAX_DAYS_BACK)
    const start = lastProcessed !== null ? addDays(lastProcessed, 1) : firstDay
    if (start === null) return []

    const days: string[] = []
    for (let day = start < floor ? floor : start; day <= last; day = addDays(day, 1)) {
      days.push(day)
    }
    return days
  }

  static monthOf(day: string): string {
    return day.slice(0, 7)
  }

  static reportsOf(
    day: string,
    newPoints: CdnTransformationPoint[],
    subjects: Map<string, CdnSubjectRef>,
  ): YupanaOutboxEntry[] {
    const bySubject = new Map<string, { subject: CdnSubjectRef; quantity: number }>()
    let unresolved = 0

    for (const point of newPoints) {
      const subject = subjects.get(CdnTransformationDay.subjectKey(point.kind, point.slug))
      if (!subject) {
        unresolved += 1
        continue
      }
      const current = bySubject.get(subject.photoId) ?? { subject, quantity: 0 }
      current.quantity += 1
      bySubject.set(subject.photoId, current)
    }

    const entries = [...bySubject.values()].map(({ subject, quantity }) =>
      YupanaUsageReport.cdnTransformations({ day, subject, quantity }),
    )
    if (unresolved > 0) {
      entries.push(
        YupanaUsageReport.cdnTransformations({ day, subject: null, quantity: unresolved }),
      )
    }
    return entries
  }
}
