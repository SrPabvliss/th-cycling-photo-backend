export const NEAR_QUOTA_PERCENT = 85

export type EventAlert =
  | 'archived'
  | 'no_cover'
  | 'quota_exhausted'
  | 'frozen'
  | 'empty'
  | 'quota_near'
  | null

export interface EventFacts {
  isArchived: boolean
  hasCover: boolean
  isFrozen: boolean
  photoCount: number
  photosUploaded: number
  photoQuota: number | null
}

export function isVisible(e: EventFacts): boolean {
  return !e.isArchived && e.hasCover
}

export function isQuotaExhausted(e: EventFacts): boolean {
  if (e.photoQuota === null) return false
  return e.photosUploaded >= e.photoQuota
}

export function isQuotaNear(e: EventFacts): boolean {
  if (e.photoQuota === null) return false
  if (isQuotaExhausted(e)) return false
  const percentUsed = (e.photosUploaded / e.photoQuota) * 100
  return percentUsed >= NEAR_QUOTA_PERCENT
}

export function quotaRemaining(e: EventFacts): number | null {
  if (e.photoQuota === null) return null
  const remaining = e.photoQuota - e.photosUploaded
  return remaining > 0 ? remaining : 0
}

export function resolveEventAlert(e: EventFacts): EventAlert {
  if (e.isArchived) return 'archived'
  if (!e.hasCover) return 'no_cover'
  if (isQuotaExhausted(e)) return 'quota_exhausted'
  if (e.isFrozen) return 'frozen'
  if (e.photoCount === 0) return 'empty'
  if (isQuotaNear(e)) return 'quota_near'
  return null
}
