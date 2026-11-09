/** Result of sending an event's failed photos back to classification. */
export class ReclassifyPhotosResultProjection {
  /** Photos sent back to the classification queue */
  enqueued: number
  /** Requested photos not sent: outside the event, not failed, or already queued */
  ignored: number
}
