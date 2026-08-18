import { PaymentTransaction } from '@payments/domain/entities'
import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import { GetPaymentTransactionHandler } from './get-payment-transaction.handler'
import { GetPaymentTransactionQuery } from './get-payment-transaction.query'

const BUYER = 'buyer-1'

function buildTransaction() {
  return PaymentTransaction.start({
    orderIds: ['order-1', 'order-2'],
    provider: 'payphone',
    clientTransactionId: 'tt-multi',
    amounts: {
      amountCents: 2500,
      amountWithoutTaxCents: 2500,
      amountWithTaxCents: 0,
      taxCents: 0,
    },
    commissionCents: 144,
    mode: PaymentMode.OWN_MERCHANT,
    receiver: 'store-1',
    storeId: 'store-1',
    transferToCents: null,
  })
}

function buildHandler(buyerUserId: string) {
  const readRepo = { findByClientTransactionId: jest.fn(() => Promise.resolve(buildTransaction())) }
  const contextRepo = {
    findByOrderIds: jest.fn(() =>
      Promise.resolve([
        {
          orderId: 'order-1',
          status: 'pending',
          subtotalDollars: 10,
          sellerUserId: 's',
          buyerUserId,
        },
        {
          orderId: 'order-2',
          status: 'pending',
          subtotalDollars: 15,
          sellerUserId: 's',
          buyerUserId,
        },
      ]),
    ),
  }

  return new GetPaymentTransactionHandler(readRepo as never, contextRepo as never)
}

describe('GetPaymentTransactionHandler', () => {
  it('returns what the return screen needs to retry', async () => {
    const handler = buildHandler(BUYER)

    const result = await handler.execute(new GetPaymentTransactionQuery('tt-multi', BUYER))

    expect(result).toMatchObject({
      clientTransactionId: 'tt-multi',
      status: PaymentTransactionStatus.INITIATED,
      amountCents: 2500,
      orderIds: ['order-1', 'order-2'],
    })
  })

  it('refuses to expose a transaction that belongs to another buyer', async () => {
    const handler = buildHandler('someone-else')

    await expect(
      handler.execute(new GetPaymentTransactionQuery('tt-multi', BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.order_not_yours' })
  })

  it('refuses to answer when the context lookup does not resolve every order', async () => {
    const readRepo = {
      findByClientTransactionId: jest.fn(() => Promise.resolve(buildTransaction())),
    }
    const contextRepo = {
      findByOrderIds: jest.fn(() =>
        Promise.resolve([
          {
            orderId: 'order-1',
            status: 'pending',
            subtotalDollars: 10,
            sellerUserId: 's',
            buyerUserId: BUYER,
          },
        ]),
      ),
    }
    const handler = new GetPaymentTransactionHandler(readRepo as never, contextRepo as never)

    await expect(
      handler.execute(new GetPaymentTransactionQuery('tt-multi', BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.order_context_missing' })
  })
})
