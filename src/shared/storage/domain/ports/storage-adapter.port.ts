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

/**
 * Port interface for storage operations.
 * Abstracts the underlying storage provider (Backblaze B2, S3, etc.)
 * so it can be swapped without changing business logic.
 */
export interface IStorageAdapter {
  /** Uploads a file to storage and returns the storage key and public URL. */
  upload(params: UploadParams): Promise<UploadResult>

  /** Constructs the public URL for a given storage key. */
  getPublicUrl(key: string): string

  /** Deletes a file from storage by its storage key. */
  delete(key: string): Promise<void>
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER')
