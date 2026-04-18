import * as crypto from 'node:crypto'
import { AppException } from '@shared/domain'
import {
  DeliveryLinkStatus,
  type DeliveryLinkStatusType,
} from '../value-objects/delivery-link-status.vo'

export class DeliveryLink {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly token: string,
    public status: DeliveryLinkStatusType,
    public readonly expiresAt: Date,
    public firstDownloadedAt: Date | null,
    public downloadCount: number,
    public readonly createdAt: Date,
  ) {}

  /**
   * Factory method for creating a new delivery link.
   * Generates a cryptographic token (64 hex chars).
   */
  static create(data: { orderId: string; expiresInDays: number }): DeliveryLink {
    DeliveryLink.validateExpiresInDays(data.expiresInDays)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + data.expiresInDays)

    return new DeliveryLink(
      crypto.randomUUID(),
      data.orderId,
      crypto.randomBytes(32).toString('hex'),
      DeliveryLinkStatus.ACTIVE,
      expiresAt,
      null,
      0,
      new Date(),
    )
  }

  /**
   * Reconstitutes an entity from persistence data.
   * No validations are applied – the data is trusted.
   */
  static fromPersistence(data: {
    id: string
    orderId: string
    token: string
    status: DeliveryLinkStatusType
    expiresAt: Date
    firstDownloadedAt: Date | null
    downloadCount: number
    createdAt: Date
  }): DeliveryLink {
    return new DeliveryLink(
      data.id,
      data.orderId,
      data.token,
      data.status,
      data.expiresAt,
      data.firstDownloadedAt,
      data.downloadCount,
      data.createdAt,
    )
  }

  /** Checks if the link has expired. If so, updates status. Returns true if expired. */
  checkExpiration(): boolean {
    if (this.status === DeliveryLinkStatus.EXPIRED) return true
    if (new Date() > this.expiresAt) {
      this.status = DeliveryLinkStatus.EXPIRED
      return true
    }
    return false
  }

  /** Records an access: sets firstDownloadedAt on first visit, increments downloadCount, marks downloaded. */
  recordAccess(): void {
    if (!this.firstDownloadedAt) {
      this.firstDownloadedAt = new Date()
    }
    this.downloadCount++
    if (this.status === DeliveryLinkStatus.ACTIVE) {
      this.status = DeliveryLinkStatus.DOWNLOADED
    }
  }

  /** Invalidates this delivery link (used when regenerating). */
  invalidate(): void {
    if (this.status === DeliveryLinkStatus.EXPIRED) {
      throw AppException.businessRule('delivery.already_expired')
    }
    this.status = DeliveryLinkStatus.EXPIRED
  }

  private static validateExpiresInDays(days: number): void {
    if (days < 1 || days > 90) {
      throw AppException.businessRule('delivery.expires_in_days_invalid')
    }
  }
}
