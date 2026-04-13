export class OrderPhotoProjection {
  id: string
  filename: string
  storageKey: string
  publicSlug: string
}

export class OrderDeliveryLinkProjection {
  token: string
  status: string
  expiresAt: Date
  downloadCount: number
}

export class OrderDetailProjection {
  /** Order UUID */
  id: string
  /** Current status */
  status: string
  /** Optional notes */
  notes: string | null
  /** When the order was created */
  createdAt: Date
  /** When payment was confirmed */
  paidAt: Date | null
  /** When photos were delivered */
  deliveredAt: Date | null
  /** When the order was cancelled */
  cancelledAt: Date | null
  /** User display name (from user relation) */
  userName: string
  /** Snap first name at time of order */
  snapFirstName: string | null
  /** Snap last name at time of order */
  snapLastName: string | null
  /** Snap WhatsApp at time of order */
  snapWhatsapp: string | null
  /** Snap email at time of order */
  snapEmail: string | null
  /** Event name */
  eventName: string
  /** Preview link token that originated this order (nullable) */
  previewLinkToken: string | null
  /** Retouch progress for the order */
  retouchProgress: { total: number; retouched: number }
  /** Photos in the order */
  photos: OrderPhotoProjection[]
  /** Delivery link (null if not yet generated) */
  deliveryLink: OrderDeliveryLinkProjection | null
}
