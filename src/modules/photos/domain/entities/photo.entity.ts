import { AppException } from '@shared/domain'
import { nanoid } from 'nanoid'
import { PhotoStatus, type PhotoStatusType } from '../value-objects/photo-status.vo'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export class Photo {
  private _createdById: string | null = null

  get createdById(): string | null {
    return this._createdById
  }

  setCreatedBy(userId: string): void {
    this._createdById = userId
  }

  constructor(
    public readonly id: string,
    public readonly eventId: string,
    public readonly filename: string,
    public readonly storageKey: string,
    public readonly publicSlug: string,
    public readonly fileSize: bigint,
    public readonly mimeType: string,
    public width: number | null,
    public height: number | null,
    public status: PhotoStatusType,
    public readonly capturedAt: Date | null,
    public readonly uploadedAt: Date,
    public processedAt: Date | null,
    public reviewedAt: Date | null,
    public retouchedStorageKey: string | null,
    public retouchedPublicSlug: string | null,
    public retouchedFileSize: bigint | null,
    public retouchedAt: Date | null,
    public retouchedById: string | null,
    public photoCategoryId: number | null,
  ) {}

  static create(data: {
    eventId: string
    filename: string
    storageKey: string
    fileSize: bigint
    mimeType: string
    width?: number | null
    height?: number | null
    capturedAt?: Date | null
    photoCategoryId?: number | null
  }): Photo {
    Photo.validateFilename(data.filename)
    Photo.validateMimeType(data.mimeType)
    Photo.validateFileSize(data.fileSize)

    return new Photo(
      crypto.randomUUID(),
      data.eventId,
      data.filename,
      data.storageKey,
      nanoid(),
      data.fileSize,
      data.mimeType,
      data.width ?? null,
      data.height ?? null,
      PhotoStatus.PENDING,
      data.capturedAt ?? null,
      new Date(),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      data.photoCategoryId ?? null,
    )
  }

  markProcessing(): void {
    this.status = PhotoStatus.PROCESSING
  }

  markProcessed(width: number | null, height: number | null): void {
    this.status = PhotoStatus.PROCESSED
    this.processedAt = new Date()
    if (width !== null) this.width = width
    if (height !== null) this.height = height
  }

  markFailed(): void {
    this.status = PhotoStatus.FAILED
    this.processedAt = new Date()
  }

  markReviewed(): void {
    this.status = PhotoStatus.REVIEWED
    this.reviewedAt = new Date()
  }

  setRetouched(
    storageKey: string,
    publicSlug: string,
    fileSize: bigint,
    retouchedById: string,
  ): void {
    this.retouchedStorageKey = storageKey
    this.retouchedPublicSlug = publicSlug
    this.retouchedFileSize = fileSize
    this.retouchedAt = new Date()
    this.retouchedById = retouchedById
  }

  clearRetouched(): void {
    this.retouchedStorageKey = null
    this.retouchedPublicSlug = null
    this.retouchedFileSize = null
    this.retouchedAt = null
    this.retouchedById = null
  }

  private static validateFilename(filename: string): void {
    if (!filename || filename.trim().length === 0) {
      throw AppException.businessRule('photo.filename_empty')
    }
  }

  private static validateMimeType(mimeType: string): void {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw AppException.businessRule('photo.invalid_mime_type')
    }
  }

  private static validateFileSize(fileSize: bigint): void {
    if (fileSize <= 0n) {
      throw AppException.businessRule('photo.invalid_file_size')
    }
  }

  static fromPersistence(data: {
    id: string
    eventId: string
    filename: string
    storageKey: string
    publicSlug: string
    fileSize: bigint
    mimeType: string
    width: number | null
    height: number | null
    status: PhotoStatusType
    capturedAt: Date | null
    uploadedAt: Date
    processedAt: Date | null
    reviewedAt: Date | null
    retouchedStorageKey: string | null
    retouchedPublicSlug: string | null
    retouchedFileSize: bigint | null
    retouchedAt: Date | null
    retouchedById?: string | null
    photoCategoryId?: number | null
  }): Photo {
    return new Photo(
      data.id,
      data.eventId,
      data.filename,
      data.storageKey,
      data.publicSlug,
      data.fileSize,
      data.mimeType,
      data.width,
      data.height,
      data.status,
      data.capturedAt,
      data.uploadedAt,
      data.processedAt,
      data.reviewedAt,
      data.retouchedStorageKey,
      data.retouchedPublicSlug,
      data.retouchedFileSize,
      data.retouchedAt,
      data.retouchedById ?? null,
      data.photoCategoryId ?? null,
    )
  }
}
