export class OrderListPreviewPhotoProjection {
  /** Photo UUID */
  photoId: string
  /** Public slug (CDN) */
  publicSlug: string
  /** Pre-built CDN thumbnail URL */
  thumbnailUrl: string
  /** Original filename */
  filename: string
}

export class OrderListProjection {
  /** Order UUID */
  id: string
  /** Current status: pending, payment_info_sent, paid, delivered, cancelled */
  status: string
  /** When the order was created */
  createdAt: Date
  /** When the admin sent payment info to the customer (null if not notified yet) */
  notifiedAt: Date | null
  /** When payment was confirmed (null if pending) */
  paidAt: Date | null
  /** When photos were delivered (null if not yet) */
  deliveredAt: Date | null
  /** Display name from snapshot at order creation time (snap_first_name + snap_last_name). For the current live customer identity, use customerFirstName/customerLastName. */
  userName: string
  /** Live user UUID (used to visually group orders by customer) */
  userId: string
  /** Live user first name (current value, not snapshot) */
  customerFirstName: string | null
  /** Live user last name (current value, not snapshot) */
  customerLastName: string | null
  /** Live user email (current value, not snapshot) */
  customerEmail: string
  /** Live user primary phone number (null if user has none flagged as primary) */
  customerPrimaryPhone: string | null
  /** Snap WhatsApp at time of order */
  snapWhatsapp: string | null
  /** Event name */
  eventName: string
  /** Number of photos in the order */
  photoCount: number
  /** Order subtotal (Decimal serialized as string to preserve precision) */
  subtotal: string | null
  /** Currency code snapshot at time of order (e.g. USD) */
  snapCurrency: string | null
  /** Whether a delivery link exists for this order */
  hasDeliveryLink: boolean
  /** First few photos in the order for thumbnail preview (max 3) */
  previewPhotos: OrderListPreviewPhotoProjection[]
}
