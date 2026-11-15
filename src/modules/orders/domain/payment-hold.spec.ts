import { isHeldByPayment } from './payment-hold'

describe('isHeldByPayment', () => {
  const unpaid = { isPaid: false }
  const paid = { isPaid: true }
  const payments = (...statuses: string[]) => ({ statuses, beingConfirmed: false })

  it('holds the order while a confirmation is running, whatever the statuses say', () => {
    expect(isHeldByPayment(unpaid, { statuses: [], beingConfirmed: true })).toBe(true)
    expect(isHeldByPayment(paid, { statuses: ['expired'], beingConfirmed: true })).toBe(true)
  })

  it('holds the order while the buyer is at the gateway or coming back from it', () => {
    expect(isHeldByPayment(unpaid, payments('initiated'))).toBe(true)
    expect(isHeldByPayment(unpaid, payments('confirming'))).toBe(true)
    expect(isHeldByPayment(paid, payments('confirming'))).toBe(true)
  })

  it('holds an unpaid order whose charge the gateway already approved', () => {
    expect(isHeldByPayment(unpaid, payments('approved'))).toBe(true)
  })

  it('releases a paid order whose charge was approved', () => {
    expect(isHeldByPayment(paid, payments('approved'))).toBe(false)
  })

  it('releases an order whose payments all ended without a charge', () => {
    expect(isHeldByPayment(unpaid, payments())).toBe(false)
    expect(isHeldByPayment(unpaid, payments('declined', 'expired', 'reversed'))).toBe(false)
  })

  it('holds as soon as one of several payments holds', () => {
    expect(isHeldByPayment(unpaid, payments('declined', 'confirming'))).toBe(true)
  })
})
