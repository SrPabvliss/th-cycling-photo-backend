import type {
  MyOrderDetailProjection,
  MyOrderDownloadRaw,
  MyOrderListProjection,
  MyOrdersSummaryProjection,
  OrderListProjection,
  OrdersStatsProjection,
  RawOrderDetailProjection,
  RetouchCompletedOrderProjection,
} from '@orders/application/projections'
import type { PendingRetouchOrderProjection } from '@photos/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { Order } from '../entities'
import { OrderStatus, type OrderStatusType } from '../value-objects/order-status.vo'

export type OrderListFilters = {
  eventId?: string
  status?: string
  search?: string
}

export const ORDER_TABS: ReadonlyArray<{
  id: keyof OrdersStatsProjection['tabs']
  status?: OrderStatusType
}> = [
  { id: 'all', status: undefined },
  { id: 'pending', status: OrderStatus.PENDING },
  { id: 'payment_info_sent', status: OrderStatus.PAYMENT_INFO_SENT },
  { id: 'paid', status: OrderStatus.PAID },
  { id: 'delivered', status: OrderStatus.DELIVERED },
  { id: 'gifted', status: OrderStatus.GIFTED },
  { id: 'cancelled', status: OrderStatus.CANCELLED },
]

export interface IOrderReadRepository {
  findById(id: string): Promise<Order | null>
  /**
   * Scoped load — the tenant-boundary check for every mutation and single-entity read here.
   * `findById` is not a safe basis for `authz.assert()`, which only tests whether the caller holds
   * the key, never whether the row is theirs. An out-of-scope id resolves to `null` (404).
   */
  findByIdInScope(id: string, scope: EventScope): Promise<Order | null>
  getList(
    pagination: Pagination,
    filters: OrderListFilters,
    scope: EventScope,
  ): Promise<PaginatedResult<OrderListProjection>>
  getDetail(id: string, scope: EventScope): Promise<RawOrderDetailProjection | null>
  countByStatus(eventId: string | undefined, scope: EventScope): Promise<Record<string, number>>
  /** Subtotal of paid + delivered orders in scope, optionally one event. Decimal string, '0' if none. */
  sumRevenue(eventId: string | undefined, scope: EventScope): Promise<string>
  /**
   * Order statistics: totals, the open/awaiting-delivery figures and the seven tab counts.
   * Scoped to the caller, optionally to one event, optionally filtered by search. `filters.status`
   * is accepted (callers reuse the same filter shape as `getList`) but deliberately ignored: the
   * tabs partition one population, so selecting a tab must never move these figures.
   */
  getStats(filters: OrderListFilters, scope: EventScope): Promise<OrdersStatsProjection>
  existsByPreviewLinkId(previewLinkId: string): Promise<boolean>
  /** True if any order line item references this photo (blocks hard-delete). */
  existsByPhotoId(photoId: string): Promise<boolean>
  getPreviewPhotoIds(previewLinkId: string): Promise<string[]>
  getPendingRetouch(scope: EventScope): Promise<PendingRetouchOrderProjection[]>
  findOrdersFullyRetouchedByPhoto(photoId: string): Promise<RetouchCompletedOrderProjection[]>
  getPhotoIdsByOrderIds(orderIds: string[]): Promise<string[]>
  getMyList(userId: string, pagination: Pagination): Promise<PaginatedResult<MyOrderListProjection>>
  getMyDetail(userId: string, orderId: string): Promise<MyOrderDetailProjection | null>
  getMyDownloadFiles(userId: string, orderId: string): Promise<MyOrderDownloadRaw[] | null>
  getMySummary(userId: string): Promise<MyOrdersSummaryProjection>
  /** True when a payment transaction for this order is still initiated or confirming. */
  hasPaymentInFlight(orderId: string): Promise<boolean>
}

export const ORDER_READ_REPOSITORY = Symbol('ORDER_READ_REPOSITORY')
