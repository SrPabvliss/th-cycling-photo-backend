/**
 * Read-side port for the operator dashboard. Owns only operator-domain
 * concerns: review/retouch progress on photos and recent activity. Event
 * identity/metadata is provided by the events module via IEventReadRepository
 * — handlers compose both.
 */

export interface ActiveEventStats {
  pendingPhotos: number
  totalProcessedPhotos: number
  retouchPendingPhotos: number
}

export interface CompletedEventStats {
  totalRetouched: number
  completedAt: Date | null
}

export type RecentActivityType = 'review' | 'retouch'

export interface RecentActivityRow {
  id: string
  type: RecentActivityType
  eventId: string
  eventName: string
  count: number
  timestamp: Date
}

export interface IOperatorReadRepository {
  countPendingReview(operatorId: string, eventIds: string[]): Promise<number>
  countPendingRetouch(operatorId: string, eventIds: string[]): Promise<number>
  getActiveEventStats(eventIds: string[]): Promise<Map<string, ActiveEventStats>>
  getCompletedEventStats(eventIds: string[]): Promise<Map<string, CompletedEventStats>>
  getRecentActivity(
    operatorId: string,
    skip: number,
    take: number,
  ): Promise<{ items: RecentActivityRow[]; total: number }>
}

export const OPERATOR_READ_REPOSITORY = Symbol('OPERATOR_READ_REPOSITORY')
