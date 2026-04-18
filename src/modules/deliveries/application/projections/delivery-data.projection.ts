export class DeliveryPhotoProjection {
  /** Photo UUID */
  id: string
  /** Original filename */
  filename: string
  /** Presigned B2 download URL (1h expiration) */
  downloadUrl: string
  /** File size in bytes */
  fileSize: number
}

export class DeliveryDataProjection {
  /** Delivery link token */
  token: string
  /** Event name */
  eventName: string
  /** Customer full name */
  customerName: string
  /** Current status */
  status: string
  /** When the delivery link expires */
  expiresAt: Date
  /** How many times the delivery page has been accessed */
  downloadCount: number
  /** Photos with presigned download URLs */
  photos: DeliveryPhotoProjection[]
}

/** Internal type returned by the repository (includes storageKey for presigned URL generation). */
export type DeliveryPhotoRaw = {
  id: string
  filename: string
  storageKey: string
  fileSize: number
}

export type DeliveryDataRaw = Omit<DeliveryDataProjection, 'photos'> & {
  photos: DeliveryPhotoRaw[]
}
