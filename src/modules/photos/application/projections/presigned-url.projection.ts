export class PresignedUrlProjection {
  /** Presigned URL for direct upload to B2 */
  url: string
  /** Storage key the URL is scoped to */
  objectKey: string
  /** Expiration time in seconds */
  expiresIn: number
}
