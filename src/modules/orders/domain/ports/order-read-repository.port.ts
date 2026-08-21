import type {
  OrderDetailProjection,
  OrderListProjection,
  RetouchCompletedOrderProjection,
} from '@orders/application/projections'
import type { PendingRetouchOrderProjection } from '@photos/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { Order } from '../entities'

export type OrderListFilters = {
  eventId?: string
  status?: string
  search?: string
}

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
  getDetail(id: string, scope: EventScope): Promise<OrderDetailProjection | null>
  countByStatus(eventId: string | undefined, scope: EventScope): Promise<Record<string, number>>
  /** Subtotal of paid + delivered orders in scope, optionally one event. Decimal string, '0' if none. */
  sumRevenue(eventId: string | undefined, scope: EventScope): Promise<string>
  existsByPreviewLinkId(previewLinkId: string): Promise<boolean>
  /** True if any order line item references this photo (blocks hard-delete). */
  existsByPhotoId(photoId: string): Promise<boolean>
  getPreviewPhotoIds(previewLinkId: string): Promise<string[]>
  getPendingRetouch(scope: EventScope): Promise<PendingRetouchOrderProjection[]>
  findOrdersFullyRetouchedByPhoto(photoId: string): Promise<RetouchCompletedOrderProjection[]>
  getPhotoIdsByOrderIds(orderIds: string[]): Promise<string[]>
}

export const ORDER_READ_REPOSITORY = Symbol('ORDER_READ_REPOSITORY')
