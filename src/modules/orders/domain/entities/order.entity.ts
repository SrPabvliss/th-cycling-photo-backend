import { type PricingTierSnapshot } from '@pricing/domain/value-objects'
import { AppException } from '@shared/domain'
import { OrderStatus, type OrderStatusType } from '../value-objects/order-status.vo'
import type { PaymentMethodType } from '../value-objects/payment-method.vo'

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
    public readonly snapCurrency: string | null,
    public readonly snapPricingConfig: PricingTierSnapshot[] | null,
    public readonly createdAt: Date,
    public notifiedAt: Date | null,
    public paidAt: Date | null,
    public deliveredAt: Date | null,
    public cancelledAt: Date | null,
    public notifiedById: string | null,
    public confirmedById: string | null,
    public paymentMethod: PaymentMethodType | null,
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
    snapCurrency?: string | null
    snapPricingConfig?: PricingTierSnapshot[] | null
    paymentMethod?: PaymentMethodType | null
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
      data.snapCurrency ?? null,
      data.snapPricingConfig ?? null,
      new Date(),
      null,
      null,
      null,
      null,
      null,
      null,
      data.paymentMethod ?? null,
    )
  }

  static createDraft(data: {
    previewLinkId: string | null
    eventId: string
    userId: string
    notes: string | null
    bibNumber?: string | null
    subtotal?: number | null
    snapCurrency?: string | null
    snapPricingConfig?: PricingTierSnapshot[] | null
    paymentMethod?: PaymentMethodType | null
  }): Order {
    return new Order(
      crypto.randomUUID(),
      data.previewLinkId,
      data.eventId,
      data.userId,
      OrderStatus.DRAFT,
      data.notes,
      data.bibNumber ?? null,
      data.subtotal ?? null,
      data.snapCurrency ?? null,
      data.snapPricingConfig ?? null,
      new Date(),
      null,
      null,
      null,
      null,
      null,
      null,
      data.paymentMethod ?? null,
    )
  }

  get isDraft(): boolean {
    return this.status === OrderStatus.DRAFT
  }

  confirmDraftAsPending(): void {
    if (this.status !== OrderStatus.DRAFT) {
      throw AppException.businessRule('order.not_draft')
    }
    this.status = OrderStatus.PENDING
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
    snapCurrency: string | null
    snapPricingConfig: PricingTierSnapshot[] | null
    createdAt: Date
    notifiedAt: Date | null
    paidAt: Date | null
    deliveredAt: Date | null
    cancelledAt: Date | null
    notifiedById: string | null
    confirmedById: string | null
    paymentMethod: PaymentMethodType | null
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
      data.snapCurrency,
      data.snapPricingConfig,
      data.createdAt,
      data.notifiedAt,
      data.paidAt,
      data.deliveredAt,
      data.cancelledAt,
      data.notifiedById,
      data.confirmedById,
      data.paymentMethod,
    )
  }

  /**
   * Marks that payment info has been sent to the customer.
   * pending → payment_info_sent (records audit fields).
   * payment_info_sent → payment_info_sent (idempotent no-op; audit preserved).
   */
  notifyPaymentInfo(notifiedById: string): void {
    if (this.status === OrderStatus.PAYMENT_INFO_SENT) return
    if (this.status !== OrderStatus.PENDING) {
      throw AppException.businessRule('order.not_pending')
    }
    this.status = OrderStatus.PAYMENT_INFO_SENT
    this.notifiedAt = new Date()
    this.notifiedById = notifiedById
  }

  /** Confirms payment: pending | payment_info_sent → paid. Sets paidAt and confirmedById. */
  confirmPayment(confirmedById: string): void {
    if (
      this.status !== OrderStatus.DRAFT &&
      this.status !== OrderStatus.PENDING &&
      this.status !== OrderStatus.PAYMENT_INFO_SENT
    ) {
      throw AppException.businessRule('order.not_pending')
    }
    this.status = OrderStatus.PAID
    this.paidAt = new Date()
    this.confirmedById = confirmedById
  }

  choosePaymentMethod(method: PaymentMethodType): void {
    if (
      this.status !== OrderStatus.DRAFT &&
      this.status !== OrderStatus.PENDING &&
      this.status !== OrderStatus.PAYMENT_INFO_SENT
    ) {
      throw AppException.businessRule('order.method_not_selectable')
    }
    this.paymentMethod = method
  }

  /** Marks as delivered: paid → delivered. Sets deliveredAt. */
  markDelivered(): void {
    if (this.status !== OrderStatus.PAID) {
      throw AppException.businessRule('order.not_paid')
    }
    this.status = OrderStatus.DELIVERED
    this.deliveredAt = new Date()
  }

  /** Marks as gift: pending | payment_info_sent → gifted (terminal). Records actor. */
  markAsGift(actorId: string): void {
    if (this.status !== OrderStatus.PENDING && this.status !== OrderStatus.PAYMENT_INFO_SENT) {
      throw AppException.businessRule('order.not_pending')
    }
    this.status = OrderStatus.GIFTED
    this.confirmedById = actorId
  }

  /** Delivers a gift: sets deliveredAt, keeps status = gifted. */
  markGiftDelivered(): void {
    if (this.status !== OrderStatus.GIFTED) {
      throw AppException.businessRule('order.not_gifted')
    }
    this.deliveredAt = new Date()
  }

  /**
   * Cancels: pending | payment_info_sent | paid | gifted → cancelled.
   * An order that has already been delivered can never be cancelled,
   * regardless of its current status.
   */
  cancel(): void {
    if (
      this.status !== OrderStatus.DRAFT &&
      this.status !== OrderStatus.PENDING &&
      this.status !== OrderStatus.PAYMENT_INFO_SENT &&
      this.status !== OrderStatus.PAID &&
      this.status !== OrderStatus.GIFTED
    ) {
      throw AppException.businessRule('order.not_cancellable')
    }
    if (this.deliveredAt !== null) {
      throw AppException.businessRule('order.not_cancellable')
    }
    this.status = OrderStatus.CANCELLED
    this.cancelledAt = new Date()
  }

  convertToSale(actorId: string): void {
    if (this.status !== OrderStatus.GIFTED) {
      throw AppException.businessRule('order.not_correctable')
    }
    this.status = this.deliveredAt ? OrderStatus.DELIVERED : OrderStatus.PAID
    this.paidAt = this.deliveredAt ?? new Date()
    this.confirmedById = actorId
  }

  convertToGift(actorId: string): void {
    if (this.status !== OrderStatus.PAID && this.status !== OrderStatus.DELIVERED) {
      throw AppException.businessRule('order.not_correctable')
    }
    this.status = OrderStatus.GIFTED
    this.paidAt = null
    this.confirmedById = actorId
  }
}
