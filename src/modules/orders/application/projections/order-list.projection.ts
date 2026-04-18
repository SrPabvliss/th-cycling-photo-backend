export class OrderListProjection {
  /** Order UUID */
  id: string
  /** Current status: pending, paid, delivered, cancelled */
  status: string
  /** When the order was created */
  createdAt: Date
  /** When payment was confirmed (null if pending) */
  paidAt: Date | null
  /** When photos were delivered (null if not yet) */
  deliveredAt: Date | null
  /** User display name */
  userName: string
  /** Snap WhatsApp at time of order */
  snapWhatsapp: string | null
  /** Event name */
  eventName: string
  /** Number of photos in the order */
  photoCount: number
  /** Whether a delivery link exists for this order */
  hasDeliveryLink: boolean
}
