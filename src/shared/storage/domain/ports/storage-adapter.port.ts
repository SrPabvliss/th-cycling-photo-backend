/** Parameters required to upload a file to storage. */
export interface UploadParams {
  /** File content as a Buffer. */
  buffer: Buffer
  /** Storage key (path) where the file will be stored. Format: `events/{eventId}/photos/{uuid}.{ext}` */
  key: string
  /** MIME type of the file (e.g., `image/jpeg`). */
  contentType: string
}

/** Result returned after a successful upload. */
export interface UploadResult {
  /** Storage key where the file was stored. */
  key: string
  /** Public URL to access the file (via CDN if configured). */
  url: string
}

/** Parameters required to generate a presigned URL. */
export interface PresignedUrlParams {
  /** Storage key (path) where the file will be uploaded. */
  key: string
  /** MIME type of the file (e.g., `image/jpeg`). */
  contentType: string
  /** URL expiration time in seconds. */
  expiresIn: number
}

/** Result returned after generating a presigned URL. */
export interface PresignedUrlResult {
  /** Presigned URL for uploading the file directly to storage. */
  url: string
  /** Storage key the URL is scoped to. */
  objectKey: string
  /** Expiration time in seconds. */
  expiresIn: number
}

/**
 * Port interface for storage operations.
 * Abstracts the underlying storage provider (Backblaze B2, S3, etc.)
 * so it can be swapped without changing business logic.
 */
export interface IStorageAdapter {
  /** Uploads a file to storage and returns the storage key and public URL. */
  upload(params: UploadParams): Promise<UploadResult>

  /** Generates a presigned URL for direct browser upload to storage. */
  getPresignedUrl(params: PresignedUrlParams): Promise<PresignedUrlResult>

  /** Constructs the public URL for a given storage key. */
  getPublicUrl(key: string): string

  /** Deletes a file from storage by its storage key. */
  delete(key: string): Promise<void>
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER')
