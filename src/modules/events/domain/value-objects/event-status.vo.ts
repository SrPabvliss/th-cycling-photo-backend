/**
 * Allowed statuses for an Event.
 *
 * - `active`   – Event is active and visible in listings
 * - `archived` – Event is archived (hidden from default listings)
 */
export const EventStatus = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const

export type EventStatusType = (typeof EventStatus)[keyof typeof EventStatus]
