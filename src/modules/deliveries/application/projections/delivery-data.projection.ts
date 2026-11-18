export class DeliveryPhotoProjection {
  /** Photo UUID */
  id: string
  /** Original filename */
  filename: string
  /** Presigned B2 download URL (1h expiration) */
  downloadUrl: string
  /** File size in bytes */
  fileSize: number
  /**
   * Signed CDN thumbnail of the delivered file, 400px wide and without watermark, valid as long as
   * downloadUrl. Null when the delivered file has no CDN slug.
   */
  thumbnailUrl: string | null
  /**
   * Signed CDN image of the delivered file at screen size, without watermark, to look at the photo
   * in full screen without downloading the original. Same lifetime and same null case.
   */
  viewUrl: string | null
}

export class DeliveryDataProjection {
  /** Delivery link token */
  token: string
  /** Event name */
  eventName: string
  /** Current status */
  status: string
  /** When the delivery link expires */
  expiresAt: Date
  /** How many times the delivery page has been accessed */
  downloadCount: number
  /** The order was paid, so it has an invoice sent by email. False for a gifted order. */
  invoiced: boolean
  /** Photos with presigned download URLs */
  photos: DeliveryPhotoProjection[]
}

/** Internal type returned by the repository (includes storageKey for presigned URL generation). */
export type DeliveryPhotoRaw = {
  id: string
  filename: string
  storageKey: string
  fileSize: number
  publicSlug: string | null
}

export type DeliveryDataRaw = Omit<DeliveryDataProjection, 'photos'> & {
  photos: DeliveryPhotoRaw[]
}
