import { AppException } from '@shared/domain'
import { OrderStatus, type OrderStatusType } from '../value-objects/order-status.vo'
import { PaymentMethod } from '../value-objects/payment-method.vo'
import { Order } from './order.entity'

const baseInput = {
  previewLinkId: null,
  eventId: 'event-1',
  userId: 'user-1',
  notes: null,
}

function buildDraftOrder(): Order {
  return Order.createDraft(baseInput)
}

function buildPendingOrder(): Order {
  return Order.create(baseInput)
}

describe('Order.notifyPaymentInfo', () => {
  it('transitions pending → payment_info_sent and records audit fields', () => {
    const order = Order.create(baseInput)
    const before = Date.now()

    order.notifyPaymentInfo('admin-1')

    expect(order.status).toBe(OrderStatus.PAYMENT_INFO_SENT)
    expect(order.notifiedById).toBe('admin-1')
    expect(order.notifiedAt).toBeInstanceOf(Date)
    expect((order.notifiedAt as Date).getTime()).toBeGreaterThanOrEqual(before)
  })

  it('is idempotent: re-notifying does not overwrite original audit fields', () => {
    const order = Order.create(baseInput)
    order.notifyPaymentInfo('admin-1')
    const firstNotifiedAt = order.notifiedAt
    const firstNotifiedBy = order.notifiedById

    order.notifyPaymentInfo('admin-2')

    expect(order.status).toBe(OrderStatus.PAYMENT_INFO_SENT)
    expect(order.notifiedAt).toBe(firstNotifiedAt)
    expect(order.notifiedById).toBe(firstNotifiedBy)
  })

  it('throws if order is already paid', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')

    expect(() => order.notifyPaymentInfo('admin-2')).toThrow(AppException)
  })

  it('throws if order is delivered', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')
    order.markDelivered()

    expect(() => order.notifyPaymentInfo('admin-2')).toThrow(AppException)
  })

  it('throws if order is cancelled', () => {
    const order = Order.create(baseInput)
    order.cancel()

    expect(() => order.notifyPaymentInfo('admin-2')).toThrow(AppException)
  })
})

describe('Order.confirmPayment (extended)', () => {
  it('accepts pending → paid', () => {
    const order = Order.create(baseInput)

    order.confirmPayment('admin-1')

    expect(order.status).toBe(OrderStatus.PAID)
    expect(order.confirmedById).toBe('admin-1')
    expect(order.paidAt).toBeInstanceOf(Date)
  })

  it('accepts payment_info_sent → paid', () => {
    const order = Order.create(baseInput)
    order.notifyPaymentInfo('admin-1')

    order.confirmPayment('admin-2')

    expect(order.status).toBe(OrderStatus.PAID)
    expect(order.confirmedById).toBe('admin-2')
  })

  it('throws when called on delivered', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')
    order.markDelivered()

    expect(() => order.confirmPayment('admin-2')).toThrow(AppException)
  })
})

describe('Order.cancel (extended)', () => {
  it('accepts pending → cancelled', () => {
    const order = Order.create(baseInput)

    order.cancel()

    expect(order.status).toBe(OrderStatus.CANCELLED)
    expect(order.cancelledAt).toBeInstanceOf(Date)
  })

  it('accepts payment_info_sent → cancelled', () => {
    const order = Order.create(baseInput)
    order.notifyPaymentInfo('admin-1')

    order.cancel()

    expect(order.status).toBe(OrderStatus.CANCELLED)
    expect(order.cancelledAt).toBeInstanceOf(Date)
  })

  it('accepts paid → cancelled (recover from mis-marked payment)', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')

    order.cancel()

    expect(order.status).toBe(OrderStatus.CANCELLED)
    expect(order.cancelledAt).toBeInstanceOf(Date)
  })

  it('accepts gifted → cancelled (recover from mis-marked gift)', () => {
    const order = Order.create(baseInput)
    order.markAsGift('admin-1')

    order.cancel()

    expect(order.status).toBe(OrderStatus.CANCELLED)
    expect(order.cancelledAt).toBeInstanceOf(Date)
  })

  it('throws when called on delivered', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')
    order.markDelivered()

    expect(() => order.cancel()).toThrow(AppException)
  })

  it('throws when called on a delivered gift', () => {
    const order = Order.create(baseInput)
    order.markAsGift('admin-1')
    order.markGiftDelivered()

    expect(() => order.cancel()).toThrow(AppException)
  })

  it('throws when called on an order converted from delivered sale to gift', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')
    order.markDelivered()
    order.convertToGift('admin-2')

    expect(() => order.cancel()).toThrow(AppException)
  })
})

describe('Order.markAsGift', () => {
  it('accepts pending → gifted and records the actor', () => {
    const order = Order.create(baseInput)

    order.markAsGift('admin-1')

    expect(order.status).toBe(OrderStatus.GIFTED)
    expect(order.confirmedById).toBe('admin-1')
    expect(order.paidAt).toBeNull()
  })

  it('accepts payment_info_sent → gifted', () => {
    const order = Order.create(baseInput)
    order.notifyPaymentInfo('admin-1')

    order.markAsGift('admin-2')

    expect(order.status).toBe(OrderStatus.GIFTED)
  })

  it('throws when called on paid', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')

    expect(() => order.markAsGift('admin-2')).toThrow(AppException)
  })
})

describe('Order.markGiftDelivered', () => {
  it('sets deliveredAt but keeps status = gifted (delivery is a separate axis)', () => {
    const order = Order.create(baseInput)
    order.markAsGift('admin-1')

    order.markGiftDelivered()

    expect(order.status).toBe(OrderStatus.GIFTED)
    expect(order.deliveredAt).toBeInstanceOf(Date)
  })

  it('throws when the order is not gifted', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')

    expect(() => order.markGiftDelivered()).toThrow(AppException)
  })
})

describe('Order.create (snapshot pricing)', () => {
  it('Order.create accepts snapshot pricing fields', () => {
    const order = Order.create({
      previewLinkId: null,
      eventId: 'e1',
      userId: 'u1',
      notes: null,
      subtotal: 17.5,
      snapCurrency: 'USD',
      snapPricingConfig: [{ minQty: 7, maxQty: 9, pricePerPhoto: 2.5 }],
    })
    expect(order.subtotal).toBe(17.5)
    expect(order.snapCurrency).toBe('USD')
    expect(order.snapPricingConfig).toEqual([{ minQty: 7, maxQty: 9, pricePerPhoto: 2.5 }])
  })

  it('Order.create defaults snapshot pricing fields to null', () => {
    const order = Order.create({
      previewLinkId: null,
      eventId: 'e1',
      userId: 'u1',
      notes: null,
    })
    expect(order.snapCurrency).toBeNull()
    expect(order.snapPricingConfig).toBeNull()
  })
})

describe('Order.convertToSale', () => {
  it('sends an undelivered gift to paid and stamps paidAt with the correction time', () => {
    const order = Order.create(baseInput)
    order.markAsGift('admin-1')
    const before = Date.now()

    order.convertToSale('admin-2')

    expect(order.status).toBe(OrderStatus.PAID)
    expect(order.paidAt).toBeInstanceOf(Date)
    expect((order.paidAt as Date).getTime()).toBeGreaterThanOrEqual(before)
    expect(order.deliveredAt).toBeNull()
    expect(order.confirmedById).toBe('admin-2')
  })

  it('sends a delivered gift to delivered and copies deliveredAt into paidAt', () => {
    const order = Order.create(baseInput)
    order.markAsGift('admin-1')
    order.markGiftDelivered()
    const deliveredAt = order.deliveredAt

    order.convertToSale('admin-2')

    expect(order.status).toBe(OrderStatus.DELIVERED)
    expect(order.paidAt).toBe(deliveredAt)
    expect(order.deliveredAt).toBe(deliveredAt)
  })

  it('throws when the order is paid', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')

    expect(() => order.convertToSale('admin-2')).toThrow(AppException)
  })

  it('throws when the order is delivered', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')
    order.markDelivered()

    expect(() => order.convertToSale('admin-2')).toThrow(AppException)
  })

  it('throws when the order is pending', () => {
    const order = Order.create(baseInput)

    expect(() => order.convertToSale('admin-1')).toThrow(AppException)
  })

  it('throws when the order is cancelled', () => {
    const order = Order.create(baseInput)
    order.cancel()

    expect(() => order.convertToSale('admin-1')).toThrow(AppException)
  })
})

describe('Order.convertToGift', () => {
  it('sends a paid order to gifted and clears paidAt', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')

    order.convertToGift('admin-2')

    expect(order.status).toBe(OrderStatus.GIFTED)
    expect(order.paidAt).toBeNull()
    expect(order.deliveredAt).toBeNull()
    expect(order.confirmedById).toBe('admin-2')
  })

  it('sends a delivered order to gifted keeping deliveredAt', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')
    order.markDelivered()
    const deliveredAt = order.deliveredAt

    order.convertToGift('admin-2')

    expect(order.status).toBe(OrderStatus.GIFTED)
    expect(order.paidAt).toBeNull()
    expect(order.deliveredAt).toBe(deliveredAt)
  })

  it('throws when the order is already gifted', () => {
    const order = Order.create(baseInput)
    order.markAsGift('admin-1')

    expect(() => order.convertToGift('admin-2')).toThrow(AppException)
  })

  it('throws when the order is pending', () => {
    const order = Order.create(baseInput)

    expect(() => order.convertToGift('admin-1')).toThrow(AppException)
  })

  it('throws when the order is cancelled', () => {
    const order = Order.create(baseInput)
    order.cancel()

    expect(() => order.convertToGift('admin-1')).toThrow(AppException)
  })
})

describe('Order.choosePaymentMethod', () => {
  it('records the payment method the buyer picked', () => {
    const order = Order.create(baseInput)

    order.choosePaymentMethod(PaymentMethod.CARD)

    expect(order.paymentMethod).toBe(PaymentMethod.CARD)
  })

  it('lets the buyer switch method after a failed attempt', () => {
    const order = Order.create(baseInput)

    order.choosePaymentMethod(PaymentMethod.CARD)
    order.choosePaymentMethod(PaymentMethod.TRANSFER)

    expect(order.paymentMethod).toBe(PaymentMethod.TRANSFER)
  })

  it('refuses to change the method once the order is settled', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('operator-1')

    expect(() => order.choosePaymentMethod(PaymentMethod.TRANSFER)).toThrow(AppException)
  })
})

describe('Order.createDraft / draft transitions', () => {
  it('starts a draft outside the operator flow', () => {
    const order = buildDraftOrder()

    expect(order.status).toBe(OrderStatus.DRAFT)
    expect(order.isDraft).toBe(true)
  })

  it('promotes a draft to pending when the buyer switches to transfer', () => {
    const order = buildDraftOrder()

    order.confirmDraftAsPending()

    expect(order.status).toBe(OrderStatus.PENDING)
  })

  it('settles a draft straight to paid when the card is approved', () => {
    const order = buildDraftOrder()

    order.confirmPayment('system-user')

    expect(order.status).toBe(OrderStatus.PAID)
    expect(order.paidAt).not.toBeNull()
  })

  it('refuses to send payment info for a draft, since the operator never sees it', () => {
    const order = buildDraftOrder()

    expect(() => order.notifyPaymentInfo('operator-1')).toThrow(AppException)
  })

  it('refuses to gift a draft', () => {
    const order = buildDraftOrder()

    expect(() => order.markAsGift('operator-1')).toThrow(AppException)
  })

  it('cancels a draft', () => {
    const order = buildDraftOrder()

    order.cancel()

    expect(order.status).toBe(OrderStatus.CANCELLED)
  })

  it('refuses to promote an order that is no longer a draft', () => {
    const order = buildPendingOrder()

    expect(() => order.confirmDraftAsPending()).toThrow(AppException)
  })

  it('records a payment method on a draft without promoting it', () => {
    const order = buildDraftOrder()

    order.choosePaymentMethod(PaymentMethod.CARD)

    expect(order.paymentMethod).toBe(PaymentMethod.CARD)
    expect(order.status).toBe(OrderStatus.DRAFT)
  })
})

function buildOrderInStatus(status: OrderStatusType): Order {
  return Order.fromPersistence({
    id: 'order-1',
    previewLinkId: null,
    eventId: 'event-1',
    userId: 'user-1',
    status,
    notes: null,
    bibNumber: null,
    subtotal: null,
    snapCurrency: null,
    snapPricingConfig: null,
    createdAt: new Date(),
    notifiedAt: null,
    paidAt: null,
    deliveredAt: null,
    cancelledAt: null,
    notifiedById: null,
    confirmedById: null,
    paymentMethod: null,
  })
}

describe('Order.cancelByOwner', () => {
  it.each([
    OrderStatus.PENDING,
    OrderStatus.PAYMENT_INFO_SENT,
  ])('cancels an order in %s', (status) => {
    const order = buildOrderInStatus(status)
    order.cancelByOwner()
    expect(order.status).toBe(OrderStatus.CANCELLED)
    expect(order.cancelledAt).toBeInstanceOf(Date)
  })

  it.each([
    OrderStatus.DRAFT,
    OrderStatus.PAID,
    OrderStatus.DELIVERED,
    OrderStatus.GIFTED,
    OrderStatus.CANCELLED,
  ])('refuses an order in %s', (status) => {
    const order = buildOrderInStatus(status)
    expect(() => order.cancelByOwner()).toThrow(/order\.not_cancellable_by_owner/)
  })
})
