import type { DeliveryLink } from '../entities'

export interface IDeliveryLinkWriteRepository {
  save(deliveryLink: DeliveryLink): Promise<DeliveryLink>
  invalidateByOrderId(orderId: string): Promise<void>
}

export const DELIVERY_LINK_WRITE_REPOSITORY = Symbol('DELIVERY_LINK_WRITE_REPOSITORY')
