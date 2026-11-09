export class EventsStatsProjection {
  /** Total number of events in scope, including archived */
  totalEvents: number
  /** Events not archived */
  activeEvents: number
  /** Events that are not archived and have a cover — sellable, per `isVisible` */
  visibleEvents: number
  /** Total photo count across scoped events */
  photosOnline: number
  /** Photos awaiting operator review (reviewed_at is null) across scoped events */
  pendingReview: number
  /** Events that hold at least one photo awaiting review */
  eventsPendingReview: number
  /** Active events at or above 85% of their quota, exhausted ones included; a null quota is never near */
  nearOrOverQuota: number
  /** Sum of order subtotal over paid and delivered orders */
  revenue: string
  /** Order count across scoped events, draft excluded */
  orders: number
  /** Orders pending or awaiting payment info */
  unpaidOrders: number
  tabs: {
    all: number
    active: number
    no_cover: number
    frozen: number
    archived: number
  }
}
