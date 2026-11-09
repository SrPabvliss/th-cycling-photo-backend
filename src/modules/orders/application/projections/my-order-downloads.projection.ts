export class MyOrderDownloadPhotoProjection {
  /** Photo UUID */
  id: string
  /** Generic download filename (photo-1.jpg, photo-2.jpg, ...) */
  filename: string
  /** File size in bytes */
  fileSize: number
  /** Presigned B2 download URL (1h expiration) */
  downloadUrl: string
}

export class MyOrderDownloadsProjection {
  /** Order UUID */
  orderId: string
  /** Photos with presigned download URLs */
  photos: MyOrderDownloadPhotoProjection[]
}

/** Internal type returned by the repository (carries storage keys for presigning). */
export type MyOrderDownloadRaw = {
  id: string
  storageKey: string
  fileSize: number
}
