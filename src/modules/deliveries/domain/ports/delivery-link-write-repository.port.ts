import type { DeliveryLink } from '../entities'

export interface IDeliveryLinkWriteRepository {
  save(deliveryLink: DeliveryLink): Promise<DeliveryLink>
  invalidateByOrderId(orderId: string): Promise<void>
  /**
   * Atomically increments `download_count` for the given link, enforcing
   * `maxAccesses` as a hard cap. Returns true if the access was recorded,
   * false if the cap was already reached (caller must reject the request).
   * Also flips `status` from `active` to `downloaded` and sets
   * `first_downloaded_at` on first access.
   */
  tryRecordAccess(id: string, maxAccesses: number): Promise<boolean>
}

export const DELIVERY_LINK_WRITE_REPOSITORY = Symbol('DELIVERY_LINK_WRITE_REPOSITORY')
