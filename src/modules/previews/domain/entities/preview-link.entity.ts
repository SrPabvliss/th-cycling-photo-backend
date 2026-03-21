import * as crypto from 'node:crypto'
import { AppException } from '@shared/domain'
import {
  PreviewLinkStatus,
  type PreviewLinkStatusType,
} from '../value-objects/preview-link-status.vo'

export class PreviewLink {
  constructor(
    public readonly id: string,
    public readonly token: string,
    public readonly eventId: string,
    public status: PreviewLinkStatusType,
    public readonly expiresAt: Date,
    public viewedAt: Date | null,
    public readonly createdAt: Date,
    public readonly createdById: string,
  ) {}

  /**
   * Factory method for creating a new preview link.
   * Generates a cryptographic token (64 hex chars).
   */
  static create(data: {
    eventId: string
    expiresInDays: number
    createdById: string
  }): PreviewLink {
    PreviewLink.validateExpiresInDays(data.expiresInDays)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + data.expiresInDays)

    return new PreviewLink(
      crypto.randomUUID(),
      crypto.randomBytes(32).toString('hex'),
      data.eventId,
      PreviewLinkStatus.ACTIVE,
      expiresAt,
      null,
      new Date(),
      data.createdById,
    )
  }

  /**
   * Reconstitutes an entity from persistence data.
   * No validations are applied – the data is trusted.
   */
  static fromPersistence(data: {
    id: string
    token: string
    eventId: string
    status: PreviewLinkStatusType
    expiresAt: Date
    viewedAt: Date | null
    createdAt: Date
    createdById: string
  }): PreviewLink {
    return new PreviewLink(
      data.id,
      data.token,
      data.eventId,
      data.status,
      data.expiresAt,
      data.viewedAt,
      data.createdAt,
      data.createdById,
    )
  }

  /** Marks as viewed on first public access. Returns true if it was the first view. */
  markViewed(): boolean {
    if (this.viewedAt) return false
    this.viewedAt = new Date()
    return true
  }

  /** Checks if the link has expired. If so, updates status. Returns true if expired. */
  checkExpiration(): boolean {
    if (this.status !== PreviewLinkStatus.ACTIVE) return this.status === PreviewLinkStatus.EXPIRED
    if (new Date() > this.expiresAt) {
      this.status = PreviewLinkStatus.EXPIRED
      return true
    }
    return false
  }

  /** Marks as converted when an order is created from this preview. */
  markConverted(): void {
    if (this.status !== PreviewLinkStatus.ACTIVE) {
      throw AppException.businessRule('preview.not_active')
    }
    this.status = PreviewLinkStatus.CONVERTED
  }

  private static validateExpiresInDays(days: number): void {
    if (days < 1 || days > 90) {
      throw AppException.businessRule('preview.expires_in_days_invalid')
    }
  }
}
