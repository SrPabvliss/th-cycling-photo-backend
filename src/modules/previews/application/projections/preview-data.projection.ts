export class PreviewPhotoProjection {
  /** Photo UUID */
  id: string
  /** Watermarked photo URL (via Cloudflare Worker) */
  url: string
}

export class PreviewDataProjection {
  /** Cryptographic token */
  token: string
  /** Event UUID, for the buyer's payment options */
  eventId: string
  /** Event name */
  eventName: string
  /** Event type, to load its participant categories */
  eventTypeId: number
  /** Public name of the event's organizer */
  organizerName: string
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
  /**
   * The live order that took the link (placed, or a card draft being paid), only when the signed-in
   * viewer is its owner. Null without a session, for anyone else, and while the link is active:
   * nothing about the order is shown to someone who does not own it.
   */
  myOrderId: string | null
}
