export class PreviewLinkCreatedProjection {
  /** Preview link UUID */
  id: string
  /** Cryptographic token (64 hex chars) */
  token: string
  /** Full preview URL for sharing */
  previewUrl: string
  /** Pre-filled WhatsApp message template */
  shareTemplate: string
}
