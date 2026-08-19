import type { ActiveDeliveryRaw, DeliveryDataRaw } from '@deliveries/application/projections'
import type { DeliveryLink } from '../entities'

export interface IDeliveryLinkReadRepository {
  findByToken(token: string): Promise<DeliveryLink | null>
  getDeliveryData(token: string): Promise<DeliveryDataRaw | null>
  findActiveByOrderIds(orderIds: string[]): Promise<ActiveDeliveryRaw[]>
}

export const DELIVERY_LINK_READ_REPOSITORY = Symbol('DELIVERY_LINK_READ_REPOSITORY')
