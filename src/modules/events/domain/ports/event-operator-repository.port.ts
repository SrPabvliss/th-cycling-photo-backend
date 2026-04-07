export interface EventOperatorProjection {
  id: string
  eventId: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  assignedAt: Date
}

export interface IEventOperatorRepository {
  assign(eventId: string, userId: string, assignedById: string): Promise<void>
  unassign(eventId: string, userId: string): Promise<void>
  findByEvent(eventId: string): Promise<EventOperatorProjection[]>
  isAssigned(eventId: string, userId: string): Promise<boolean>
  findFirstOperatorId(): Promise<string | null>
}

export const EVENT_OPERATOR_REPOSITORY = Symbol('EVENT_OPERATOR_REPOSITORY')
