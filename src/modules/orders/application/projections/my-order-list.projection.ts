/**
 * `confirming` is a card order whose payment is being confirmed with the gateway, or was approved
 * and is about to be settled. It cannot be cancelled or downloaded yet.
 */
export type MyOrderCustomerState = 'in_process' | 'confirming' | 'ready' | 'gifted' | 'cancelled'

export class MyOrderPreviewPhotoProjection {
  /** Photo UUID */
  photoId: string
  /** Watermarked gallery URL */
  galleryUrl: string
}

export class MyOrderListProjection {
  /** Order UUID */
  id: string
  /** What the customer sees, derived from the internal status */
  state: MyOrderCustomerState
  /** Event name */
  eventName: string
  /** When the order was created */
  createdAt: Date
  /** Number of photos in the order */
  photoCount: number
  /** Order subtotal (Decimal serialized as string to preserve precision) */
  subtotal: string | null
  /** Currency code snapshot at time of order (e.g. USD) */
  snapCurrency: string | null
  /** Up to three watermarked thumbnails */
  previewPhotos: MyOrderPreviewPhotoProjection[]
}
