export class PreviewPhotoProjection {
  /** Photo UUID */
  id: string
  /** Watermarked photo URL (via Cloudflare Worker) */
  url: string
}

export class PreviewDataProjection {
  /** Cryptographic token */
  token: string
  /** Event name */
  eventName: string
  /** Event start date */
  startDate: Date
  /** Event end date */
  endDate: Date
  /** Current status */
  status: string
  /** When the link expires */
  expiresAt: Date
  /** Photos with watermarked URLs */
  photos: PreviewPhotoProjection[]
}
