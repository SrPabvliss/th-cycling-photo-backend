// 'frozen' remains in the Prisma enum but is superseded by Event.isFrozen; see TIT-47.
export const EventStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const

export type EventStatusType = (typeof EventStatus)[keyof typeof EventStatus]
