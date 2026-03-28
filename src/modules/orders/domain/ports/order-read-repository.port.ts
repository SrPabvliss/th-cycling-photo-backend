import type { OrderDetailProjection, OrderListProjection } from '@orders/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { Order } from '../entities'

export type OrderListFilters = {
  eventId?: string
  status?: string
  search?: string
}

export interface IOrderReadRepository {
  findById(id: string): Promise<Order | null>
  getList(
    pagination: Pagination,
    filters: OrderListFilters,
  ): Promise<PaginatedResult<OrderListProjection>>
  getDetail(id: string): Promise<OrderDetailProjection | null>
  countByStatus(): Promise<Record<string, number>>
  existsByPreviewLinkId(previewLinkId: string): Promise<boolean>
  getPreviewPhotoIds(previewLinkId: string): Promise<string[]>
}

export const ORDER_READ_REPOSITORY = Symbol('ORDER_READ_REPOSITORY')
