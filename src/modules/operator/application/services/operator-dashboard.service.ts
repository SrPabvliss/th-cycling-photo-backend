import { Inject, Injectable } from '@nestjs/common'
import type {
  ClassificationProgress,
  IOperatorDashboardRepository,
  RetouchProgress,
} from '../../domain/ports'
import { OPERATOR_DASHBOARD_REPOSITORY } from '../../domain/ports'
import * as DashboardMapper from '../../infrastructure/mappers/operator-dashboard.mapper'
import type { OperatorDashboardProjection } from '../projections'

@Injectable()
export class OperatorDashboardService {
  constructor(
    @Inject(OPERATOR_DASHBOARD_REPOSITORY)
    private readonly repo: IOperatorDashboardRepository,
  ) {}

  async getDashboard(operatorId: string, cdnUrl: string): Promise<OperatorDashboardProjection> {
    const events = await this.repo.getAssignedEvents(operatorId)
    const eventIds = events.map((e) => e.eventId)

    if (eventIds.length === 0) {
      return DashboardMapper.toDashboardProjection([], [], [])
    }

    const [classificationProgress, retouchProgress, lastActions, rawActivity] = await Promise.all([
      this.repo.getClassificationProgress(eventIds),
      this.repo.getRetouchProgress(eventIds),
      this.repo.getLastActionDates(eventIds),
      this.repo.getRecentActivity(operatorId, 10),
    ])

    const classMap = new Map(classificationProgress.map((c) => [c.eventId, c]))
    const retouchMap = new Map(retouchProgress.map((r) => [r.eventId, r]))
    const actionMap = new Map(lastActions.map((a) => [a.eventId, a]))

    const defaultClassification = (eventId: string): ClassificationProgress => ({
      eventId,
      total: 0,
      classified: 0,
    })
    const defaultRetouch = (eventId: string): RetouchProgress => ({
      eventId,
      pendingOrders: 0,
      pendingPhotos: 0,
    })

    const activeEvents = events
      .filter((event) => {
        const classification = classMap.get(event.eventId) ?? defaultClassification(event.eventId)
        const retouch = retouchMap.get(event.eventId) ?? defaultRetouch(event.eventId)
        return !this.isEventCompleted(classification, retouch)
      })
      .map((event) => {
        const classification = classMap.get(event.eventId) ?? defaultClassification(event.eventId)
        const retouch = retouchMap.get(event.eventId) ?? defaultRetouch(event.eventId)
        const coverUrl = DashboardMapper.buildCoverUrl(event.coverStorageKey, cdnUrl)
        return DashboardMapper.toActiveEventProjection(event, classification, retouch, coverUrl)
      })

    const completedEvents = events
      .filter((event) => {
        const classification = classMap.get(event.eventId) ?? defaultClassification(event.eventId)
        const retouch = retouchMap.get(event.eventId) ?? defaultRetouch(event.eventId)
        return this.isEventCompleted(classification, retouch)
      })
      .map((event) => {
        const classification = classMap.get(event.eventId) ?? defaultClassification(event.eventId)
        const completedAt = DashboardMapper.resolveCompletedAt(
          actionMap.get(event.eventId),
          event.eventDate,
        )
        const coverUrl = DashboardMapper.buildCoverUrl(event.coverStorageKey, cdnUrl)
        return DashboardMapper.toCompletedEventProjection(
          event,
          classification.classified,
          completedAt,
          coverUrl,
        )
      })

    const recentActivity = rawActivity.map(DashboardMapper.toRecentActivityProjection)

    return DashboardMapper.toDashboardProjection(activeEvents, completedEvents, recentActivity)
  }

  private isEventCompleted(
    classification: ClassificationProgress,
    retouch: RetouchProgress,
  ): boolean {
    const allClassified =
      classification.total > 0 && classification.classified === classification.total
    return allClassified && retouch.pendingPhotos === 0
  }
}
