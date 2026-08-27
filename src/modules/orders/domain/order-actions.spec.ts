import { type OrderActionFacts, primaryOrderAction, resolveOrderActions } from './order-actions'

const at = (s: string) => new Date(s)
const ids = (o: OrderActionFacts, p: boolean) => resolveOrderActions(o, p).map((a) => a.id)

describe('resolveOrderActions', () => {
  it('offers notify, confirm and cancel on a pending order', () => {
    expect(ids({ status: 'pending', deliveredAt: null }, false)).toEqual([
      'notify',
      'confirm',
      'cancel',
    ])
  })

  it('adds the gift action for a platform reader only', () => {
    expect(ids({ status: 'pending', deliveredAt: null }, true)).toContain('gift')
    expect(ids({ status: 'pending', deliveredAt: null }, false)).not.toContain('gift')
  })

  it('makes confirm the primary action once payment info was sent, and offers resend', () => {
    const o = { status: 'payment_info_sent', deliveredAt: null }
    expect(primaryOrderAction(o, false)?.id).toBe('confirm')
    expect(ids(o, false)).toContain('resend')
  })

  it('offers delivery on a paid order, and the correction to gift only for platform', () => {
    const o = { status: 'paid', deliveredAt: null }
    expect(primaryOrderAction(o, false)?.id).toBe('deliver')
    expect(ids(o, true)).toContain('to_gift')
    expect(ids(o, false)).not.toContain('to_gift')
  })

  it('never offers cancel once the order was delivered, whatever its status says', () => {
    expect(ids({ status: 'delivered', deliveredAt: at('2026-08-20') }, true)).not.toContain(
      'cancel',
    )
    expect(ids({ status: 'gifted', deliveredAt: at('2026-08-20') }, true)).not.toContain('cancel')
  })

  it('separates the two faces of a gifted order', () => {
    const undelivered = { status: 'gifted', deliveredAt: null }
    const delivered = { status: 'gifted', deliveredAt: at('2026-08-20') }
    expect(primaryOrderAction(undelivered, false)?.id).toBe('deliver')
    expect(ids(undelivered, false)).toContain('cancel')
    expect(primaryOrderAction(delivered, false)).toBeNull()
    expect(ids(delivered, false)).toEqual(['regenerate'])
  })

  it('offers nothing on a draft order — an abandoned cart is not work', () => {
    expect(ids({ status: 'draft', deliveredAt: null }, true)).toEqual([])
    expect(primaryOrderAction({ status: 'draft', deliveredAt: null }, true)).toBeNull()
  })

  it('offers nothing on a cancelled order', () => {
    expect(ids({ status: 'cancelled', deliveredAt: null }, true)).toEqual([])
  })

  it('marks cancel as the danger action and never as primary', () => {
    const actions = resolveOrderActions({ status: 'pending', deliveredAt: null }, false)
    expect(actions.find((a) => a.id === 'cancel')?.kind).toBe('danger')
    expect(primaryOrderAction({ status: 'pending', deliveredAt: null }, false)?.id).toBe('notify')
  })
})
