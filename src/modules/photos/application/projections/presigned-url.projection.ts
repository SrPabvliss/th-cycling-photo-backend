export class PresignedUrlProjection {
  /** Whether this file was already uploaded for the event */
  isDuplicate: boolean
  /** Presigned URL for direct upload to B2 (null if duplicate) */
  url: string | null
  /** Storage key the URL is scoped to (null if duplicate) */
  objectKey: string | null
  /** Expiration time in seconds (null if duplicate) */
  expiresIn: number | null
}
