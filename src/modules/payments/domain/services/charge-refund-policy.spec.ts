import { RefundReason, refundReasonFor } from './charge-refund-policy'

describe('refundReasonFor', () => {
  it.each([
    ['cancelled', false, RefundReason.ORDER_CANCELLED],
    ['cancelled', true, RefundReason.ORDER_CANCELLED],
    ['gifted', false, RefundReason.ORDER_GIFTED],
    ['paid', true, RefundReason.ORDER_PAID],
    ['delivered', true, RefundReason.ORDER_PAID],
  ])('asks to refund a charge for a %s order (paid by another payment: %s)', (status, other, reason) => {
    expect(refundReasonFor(status, other)).toBe(reason)
  })

  it.each(['paid', 'delivered'])('keeps the charge that paid a %s order itself', (status) => {
    expect(refundReasonFor(status, false)).toBeNull()
  })

  it.each([
    'draft',
    'pending',
    'payment_info_sent',
  ])('has nothing to refund on a %s order, which the charge settles', (status) => {
    expect(refundReasonFor(status, true)).toBeNull()
  })
})
