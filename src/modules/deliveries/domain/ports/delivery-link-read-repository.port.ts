import type { DeliveryDataRaw } from '@deliveries/application/projections'
import type { DeliveryLink } from '../entities'

export interface IDeliveryLinkReadRepository {
  findByToken(token: string): Promise<DeliveryLink | null>
  getDeliveryData(token: string): Promise<DeliveryDataRaw | null>
}

export const DELIVERY_LINK_READ_REPOSITORY = Symbol('DELIVERY_LINK_READ_REPOSITORY')
