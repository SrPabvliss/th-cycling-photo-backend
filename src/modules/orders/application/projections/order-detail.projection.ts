export class OrderCustomerProjection {
  id: string
  firstName: string
  lastName: string
  whatsapp: string
  email: string | null
}

export class OrderPhotoProjection {
  id: string
  filename: string
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
  /** Customer data */
  customer: OrderCustomerProjection
  /** Event name */
  eventName: string
  /** Preview link token that originated this order */
  previewLinkToken: string
  /** Photos in the order */
  photos: OrderPhotoProjection[]
  /** Delivery link (null if not yet generated) */
  deliveryLink: OrderDeliveryLinkProjection | null
}
