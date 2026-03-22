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
  /** Customer full name */
  customerName: string
  /** Customer WhatsApp number */
  customerWhatsapp: string
  /** Event name */
  eventName: string
  /** Number of photos in the order */
  photoCount: number
  /** Whether a delivery link exists for this order */
  hasDeliveryLink: boolean
}
