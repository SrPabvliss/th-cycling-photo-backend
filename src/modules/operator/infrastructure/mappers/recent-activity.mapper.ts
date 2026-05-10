import type { I18nService } from 'nestjs-i18n'
import type { RecentActivityProjection } from '../../application/projections/recent-activity.projection'
import type { RecentActivityRow } from '../../domain/ports'

export function toRecentActivityProjection(
  row: RecentActivityRow,
  i18n: I18nService,
  lang: string,
): RecentActivityProjection {
  const suffix = row.count === 1 ? 'one' : 'other'
  const key = `operator.activity.${row.type}_${suffix}`
  const description = i18n.translate(key, { lang, args: { count: row.count } }) as string
  return {
    id: row.id,
    type: row.type,
    eventId: row.eventId,
    eventName: row.eventName,
    count: row.count,
    description,
    timestamp: row.timestamp.toISOString(),
  }
}
