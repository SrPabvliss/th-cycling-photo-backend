export interface AssignedEventRow {
  eventId: string
  name: string
  eventDate: Date
  location: string
  coverStorageKey: string | null
}

export interface ClassificationProgress {
  eventId: string
  total: number
  classified: number
}

export interface RetouchProgress {
  eventId: string
  pendingOrders: number
  pendingPhotos: number
}

export interface LastActionDate {
  eventId: string
  lastClassifiedAt: Date | null
  lastRetouchedAt: Date | null
}

export interface RecentActivityRow {
  type: 'classification' | 'retouch'
  eventName: string
  timestamp: Date
}

export interface IOperatorDashboardRepository {
  getAssignedEvents(operatorId: string): Promise<AssignedEventRow[]>
  getClassificationProgress(eventIds: string[]): Promise<ClassificationProgress[]>
  getRetouchProgress(eventIds: string[]): Promise<RetouchProgress[]>
  getLastActionDates(eventIds: string[]): Promise<LastActionDate[]>
  getRecentActivity(operatorId: string, limit: number): Promise<RecentActivityRow[]>
}

export const OPERATOR_DASHBOARD_REPOSITORY = Symbol('OPERATOR_DASHBOARD_REPOSITORY')
