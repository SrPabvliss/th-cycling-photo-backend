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
  /** First few photos in the order for thumbnail preview (max 3) */
  previewPhotos: OrderListPreviewPhotoProjection[]
}
