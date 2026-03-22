export class DeliveryLinkCreatedProjection {
  /** Delivery link UUID */
  id: string
  /** Cryptographic token (64 hex chars) */
  token: string
  /** Full delivery URL for sharing */
  deliveryUrl: string
}
