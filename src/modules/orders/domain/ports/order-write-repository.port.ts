import type { Order } from '../entities'

export type OrderSnapData = {
  snapFirstName: string | null
  snapLastName: string | null
  snapEmail: string
  snapPhone: string | null
  snapCountryId: number | null
  snapProvinceId: number | null
  snapCantonId: number | null
  snapCategoryName: string | null
}

export interface IOrderWriteRepository {
  save(order: Order): Promise<Order>
  saveWithSnap(order: Order, snap: OrderSnapData): Promise<Order>
  savePhotos(orderId: string, photoIds: string[]): Promise<void>
  updateItemsDeliveredAs(orderId: string): Promise<void>
}

export const ORDER_WRITE_REPOSITORY = Symbol('ORDER_WRITE_REPOSITORY')
