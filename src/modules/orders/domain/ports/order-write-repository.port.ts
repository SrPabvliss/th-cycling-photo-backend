import type { Order } from '../entities'

export interface IOrderWriteRepository {
  save(order: Order): Promise<Order>
  savePhotos(orderId: string, photoIds: string[]): Promise<void>
}

export const ORDER_WRITE_REPOSITORY = Symbol('ORDER_WRITE_REPOSITORY')
