import { Inject, Injectable } from '@nestjs/common'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type { IOperatorDashboardRepository, RetouchProgress } from '../../domain/ports'
import { OPERATOR_DASHBOARD_REPOSITORY } from '../../domain/ports'
import * as DashboardMapper from '../../infrastructure/mappers/operator-dashboard.mapper'
import type { OperatorDashboardProjection } from '../projections'

@Injectable()
export class OperatorDashboardService {
  constructor(
    @Inject(OPERATOR_DASHBOARD_REPOSITORY)
    private readonly repo: IOperatorDashboardRepository,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async getDashboard(operatorId: string): Promise<OperatorDashboardProjection> {
    const events = await this.repo.getAssignedEvents(operatorId)
    const eventIds = events.map((e) => e.eventId)

    if (eventIds.length === 0) {
      return DashboardMapper.toDashboardProjection([], [], [])
    }

    const [retouchProgress, lastActions, rawActivity] = await Promise.all([
      this.repo.getRetouchProgress(eventIds),
      this.repo.getLastActionDates(eventIds),
      this.repo.getRecentActivity(operatorId, 10),
    ])

    const retouchMap = new Map(retouchProgress.map((r) => [r.eventId, r]))
    const actionMap = new Map(lastActions.map((a) => [a.eventId, a]))

    const defaultRetouch = (eventId: string): RetouchProgress => ({
      eventId,
      pendingOrders: 0,
      pendingPhotos: 0,
    })

    const activeEvents = events
      .filter((event) => {
        const actions = actionMap.get(event.eventId)
        const retouch = retouchMap.get(event.eventId) ?? defaultRetouch(event.eventId)
        return !this.isEventCompleted(retouch, actions)
      })
      .map((event) => {
        const retouch = retouchMap.get(event.eventId) ?? defaultRetouch(event.eventId)
        const coverUrl = DashboardMapper.buildCoverUrl(event.coverPublicSlug, this.cdn)
        return DashboardMapper.toActiveEventProjection(event, retouch, coverUrl)
      })

    const completedEvents = events
      .filter((event) => {
        const actions = actionMap.get(event.eventId)
        const retouch = retouchMap.get(event.eventId) ?? defaultRetouch(event.eventId)
        return this.isEventCompleted(retouch, actions)
      })
      .map((event) => {
        const actions = actionMap.get(event.eventId)
        const totalRetouched = actions?.totalRetouched ?? 0
        const completedAt = DashboardMapper.resolveCompletedAt(actions, event.eventDate)
        const coverUrl = DashboardMapper.buildCoverUrl(event.coverPublicSlug, this.cdn)
        return DashboardMapper.toCompletedEventProjection(
          event,
          totalRetouched,
          completedAt,
          coverUrl,
        )
      })

    const recentActivity = rawActivity
      .filter((a) => a.type === 'retouch')
      .map(DashboardMapper.toRecentActivityProjection)

    return DashboardMapper.toDashboardProjection(activeEvents, completedEvents, recentActivity)
  }

  /** An event is completed when there's no pending retouch AND some retouch was done before. */
  private isEventCompleted(
    retouch: RetouchProgress,
    actions?: { lastRetouchedAt: Date | null; totalRetouched?: number },
  ): boolean {
    const hasRetouchHistory = actions?.lastRetouchedAt != null
    return hasRetouchHistory && retouch.pendingPhotos === 0
  }
}
