export class PreviewLinkListProjection {
  /** Preview link UUID */
  id: string
  /** Cryptographic token */
  token: string
  /** Current status: active, expired, converted */
  status: string
  /** When the link expires */
  expiresAt: Date
  /** When the link was first viewed (null if never) */
  viewedAt: Date | null
  /** When the link was created */
  createdAt: Date
  /** Number of photos in this preview */
  photoCount: number
  /** Number of orders generated from this preview */
  orderCount: number
}
