import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import { PaymentTransactionReadRepository } from './payment-transaction-read.repository'

const EIGHT_MINUTES_MS = 8 * 60 * 1000

function buildRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    order_id: 'order-1',
    client_transaction_id: 'tt-open',
    provider: 'payphone',
    gateway_transaction_id: null,
    status: PaymentTransactionStatus.INITIATED,
    amount_cents: 2000,
    amount_without_tax_cents: 2000,
    amount_with_tax_cents: 0,
    tax_cents: 0,
    commission_cents: 115,
    transfer_to_cents: null,
    mode_snapshot: PaymentMode.OWN_MERCHANT,
    receiver_snapshot: 'their-store',
    store_id_snapshot: 'their-store',
    authorization_code: null,
    card_brand: null,
    last_digits: null,
    confirm_payload: null,
    failure_message: null,
    confirmed_at: null,
    created_at: new Date(),
    ...overrides,
  }
}

function buildRepository(rows: ReturnType<typeof buildRecord>[]) {
  const findFirst = jest.fn().mockImplementation(({ where }) => {
    const match = rows.find(
      (row) =>
        row.order_id === where.order_id &&
        where.status.in.includes(row.status) &&
        row.created_at >= where.created_at.gte,
    )
    return Promise.resolve(match ?? null)
  })

  const prisma = { paymentTransaction: { findFirst } }
  return {
    repository: new PaymentTransactionReadRepository(prisma as never),
    findFirst,
  }
}

describe('PaymentTransactionReadRepository.findActiveByOrderId', () => {
  it('returns an open transaction created inside the reusable window', async () => {
    const { repository } = buildRepository([
      buildRecord({ created_at: new Date(Date.now() - 60_000) }),
    ])

    const found = await repository.findActiveByOrderId('order-1')

    expect(found?.clientTransactionId).toBe('tt-open')
  })

  it('ignores an open transaction older than the reusable window, since the vendor form has expired', async () => {
    const { repository } = buildRepository([
      buildRecord({ created_at: new Date(Date.now() - EIGHT_MINUTES_MS - 60_000) }),
    ])

    await expect(repository.findActiveByOrderId('order-1')).resolves.toBeNull()
  })

  it('bounds the query by the reusable window rather than filtering afterwards', async () => {
    const { repository, findFirst } = buildRepository([])

    await repository.findActiveByOrderId('order-1')

    const { where } = findFirst.mock.calls[0][0]
    const bound = (where.created_at.gte as Date).getTime()

    expect(Date.now() - bound).toBeGreaterThanOrEqual(EIGHT_MINUTES_MS)
    expect(Date.now() - bound).toBeLessThan(EIGHT_MINUTES_MS + 5_000)
  })

  it('ignores a transaction that already settled', async () => {
    const { repository } = buildRepository([
      buildRecord({ status: PaymentTransactionStatus.DECLINED }),
    ])

    await expect(repository.findActiveByOrderId('order-1')).resolves.toBeNull()
  })
})
