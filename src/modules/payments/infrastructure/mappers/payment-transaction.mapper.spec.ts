import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import * as PaymentTransactionMapper from './payment-transaction.mapper'

const RECORD = {
  id: 'row-1',
  client_transaction_id: 'tt-multi',
  provider: 'payphone',
  gateway_transaction_id: null,
  status: PaymentTransactionStatus.INITIATED,
  amount_cents: 3000,
  amount_without_tax_cents: 3000,
  amount_with_tax_cents: 0,
  tax_cents: 0,
  commission_cents: 173,
  transfer_to_cents: null,
  mode_snapshot: PaymentMode.OWN_MERCHANT,
  receiver_snapshot: 'store-1',
  store_id_snapshot: 'store-1',
  authorization_code: null,
  card_brand: null,
  last_digits: null,
  confirm_payload: null,
  failure_message: null,
  confirmed_at: null,
  created_at: new Date(),
}

describe('payment transaction mapper', () => {
  it('reads the order set from the join rows', () => {
    const entity = PaymentTransactionMapper.toEntity({
      ...RECORD,
      orders: [{ order_id: 'order-1' }, { order_id: 'order-2' }],
    } as never)

    expect(entity.orderIds).toEqual(['order-1', 'order-2'])
  })

  it('keeps the order set out of the scalar payload, since it lives in its own table', () => {
    const entity = PaymentTransactionMapper.toEntity({
      ...RECORD,
      orders: [{ order_id: 'order-1' }],
    } as never)

    expect(PaymentTransactionMapper.toPersistence(entity)).not.toHaveProperty('order_id')
  })
})
