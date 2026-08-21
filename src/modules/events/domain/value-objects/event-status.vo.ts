export const EventStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
  FROZEN: 'frozen',
} as const

export type EventStatusType = (typeof EventStatus)[keyof typeof EventStatus]
