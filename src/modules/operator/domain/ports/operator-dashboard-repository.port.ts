export interface AssignedEventRow {
  eventId: string
  name: string
  eventDate: Date
  location: string
  coverPublicSlug: string | null
}

export interface RetouchProgress {
  eventId: string
  pendingOrders: number
  pendingPhotos: number
}

export interface LastActionDate {
  eventId: string
  lastRetouchedAt: Date | null
  totalRetouched: number
}

export interface RecentActivityRow {
  type: 'retouch'
  eventName: string
  timestamp: Date
}

export interface IOperatorDashboardRepository {
  getAssignedEvents(operatorId: string): Promise<AssignedEventRow[]>
  getRetouchProgress(eventIds: string[]): Promise<RetouchProgress[]>
  getLastActionDates(eventIds: string[]): Promise<LastActionDate[]>
  getRecentActivity(operatorId: string, limit: number): Promise<RecentActivityRow[]>
}

export const OPERATOR_DASHBOARD_REPOSITORY = Symbol('OPERATOR_DASHBOARD_REPOSITORY')
