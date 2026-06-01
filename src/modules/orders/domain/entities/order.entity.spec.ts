import { AppException } from '@shared/domain'
import { OrderStatus } from '../value-objects/order-status.vo'
import { Order } from './order.entity'

const baseInput = {
  previewLinkId: null,
  eventId: 'event-1',
  userId: 'user-1',
  notes: null,
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

  it('throws when called on paid', () => {
    const order = Order.create(baseInput)
    order.confirmPayment('admin-1')

    expect(() => order.cancel()).toThrow(AppException)
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
