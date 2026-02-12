export class PhotoListProjection {
  /** Photo UUID */
  id: string
  /** Parent event UUID */
  eventId: string
  /** Original filename */
  filename: string
  /** Storage key for CDN URL resolution */
  storageKey: string
  /** Current processing status */
  status: string
  /** Image width in pixels */
  width: number | null
  /** Image height in pixels */
  height: number | null
  /** When the photo was uploaded */
  uploadedAt: Date
}
