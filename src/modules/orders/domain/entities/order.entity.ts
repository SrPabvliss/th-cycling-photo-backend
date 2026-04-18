import { AppException } from '@shared/domain'
import { OrderStatus, type OrderStatusType } from '../value-objects/order-status.vo'

export class Order {
  constructor(
    public readonly id: string,
    public readonly previewLinkId: string | null,
    public readonly eventId: string,
    public readonly userId: string,
    public status: OrderStatusType,
    public readonly notes: string | null,
    public readonly bibNumber: string | null,
    public readonly subtotal: number | null,
    public readonly createdAt: Date,
    public paidAt: Date | null,
    public deliveredAt: Date | null,
    public cancelledAt: Date | null,
    public confirmedById: string | null,
  ) {}

  /**
   * Factory method for creating a new order.
   * Status starts as pending.
   */
  static create(data: {
    previewLinkId: string | null
    eventId: string
    userId: string
    notes: string | null
    bibNumber?: string | null
    subtotal?: number | null
  }): Order {
    return new Order(
      crypto.randomUUID(),
      data.previewLinkId,
      data.eventId,
      data.userId,
      OrderStatus.PENDING,
      data.notes,
      data.bibNumber ?? null,
      data.subtotal ?? null,
      new Date(),
      null,
      null,
      null,
      null,
    )
  }

  /**
   * Reconstitutes an entity from persistence data.
   * No validations are applied – the data is trusted.
   */
  static fromPersistence(data: {
    id: string
    previewLinkId: string | null
    eventId: string
    userId: string
    status: OrderStatusType
    notes: string | null
    bibNumber: string | null
    subtotal: number | null
    createdAt: Date
    paidAt: Date | null
    deliveredAt: Date | null
    cancelledAt: Date | null
    confirmedById: string | null
  }): Order {
    return new Order(
      data.id,
      data.previewLinkId,
      data.eventId,
      data.userId,
      data.status,
      data.notes,
      data.bibNumber,
      data.subtotal,
      data.createdAt,
      data.paidAt,
      data.deliveredAt,
      data.cancelledAt,
      data.confirmedById,
    )
  }

  /** Confirms payment: pending → paid. Sets paidAt and confirmedById. */
  confirmPayment(confirmedById: string): void {
    if (this.status !== OrderStatus.PENDING) {
      throw AppException.businessRule('order.not_pending')
    }
    this.status = OrderStatus.PAID
    this.paidAt = new Date()
    this.confirmedById = confirmedById
  }

  /** Marks as delivered: paid → delivered. Sets deliveredAt. */
  markDelivered(): void {
    if (this.status !== OrderStatus.PAID) {
      throw AppException.businessRule('order.not_paid')
    }
    this.status = OrderStatus.DELIVERED
    this.deliveredAt = new Date()
  }

  /** Cancels the order: pending → cancelled. Sets cancelledAt. */
  cancel(): void {
    if (this.status !== OrderStatus.PENDING) {
      throw AppException.businessRule('order.not_pending')
    }
    this.status = OrderStatus.CANCELLED
    this.cancelledAt = new Date()
  }
}
