import { AppException } from '@shared/domain'
import { PhotoStatus, type PhotoStatusType } from '../value-objects/photo-status.vo'
import type { UnclassifiedReasonType } from '../value-objects/unclassified-reason.vo'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export class Photo {
  constructor(
    public readonly id: string,
    public readonly eventId: string,
    public readonly filename: string,
    public readonly storageKey: string,
    public readonly fileSize: bigint,
    public readonly mimeType: string,
    public width: number | null,
    public height: number | null,
    public status: PhotoStatusType,
    public unclassifiedReason: UnclassifiedReasonType | null,
    public readonly capturedAt: Date | null,
    public readonly uploadedAt: Date,
    public processedAt: Date | null,
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
  }): Photo {
    Photo.validateFilename(data.filename)
    Photo.validateMimeType(data.mimeType)
    Photo.validateFileSize(data.fileSize)

    return new Photo(
      crypto.randomUUID(),
      data.eventId,
      data.filename,
      data.storageKey,
      data.fileSize,
      data.mimeType,
      data.width ?? null,
      data.height ?? null,
      PhotoStatus.PENDING,
      null,
      data.capturedAt ?? null,
      new Date(),
      null,
    )
  }

  markAsCompleted(): void {
    this.status = PhotoStatus.COMPLETED
    this.processedAt = new Date()
  }

  markAsFailed(reason: UnclassifiedReasonType): void {
    this.status = PhotoStatus.FAILED
    this.unclassifiedReason = reason
    this.processedAt = new Date()
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
    fileSize: bigint
    mimeType: string
    width: number | null
    height: number | null
    status: PhotoStatusType
    unclassifiedReason: UnclassifiedReasonType | null
    capturedAt: Date | null
    uploadedAt: Date
    processedAt: Date | null
  }): Photo {
    return new Photo(
      data.id,
      data.eventId,
      data.filename,
      data.storageKey,
      data.fileSize,
      data.mimeType,
      data.width,
      data.height,
      data.status,
      data.unclassifiedReason,
      data.capturedAt,
      data.uploadedAt,
      data.processedAt,
    )
  }
}
