import type { AuthorizationResult } from '@shared/payment-gateways'
import { PaymentMode } from '../value-objects/payment-mode.vo'
import { PaymentTransactionStatus } from '../value-objects/payment-transaction-status.vo'
import { PaymentTransaction } from './payment-transaction.entity'

const AMOUNTS = {
  amountCents: 2000,
  amountWithoutTaxCents: 2000,
  amountWithTaxCents: 0,
  taxCents: 0,
}

function buildTransaction(): PaymentTransaction {
  return PaymentTransaction.start({
    orderIds: ['order-1'],
    provider: 'payphone',
    clientTransactionId: 'tx-1',
    amounts: AMOUNTS,
    commissionCents: 115,
    mode: PaymentMode.OWN_MERCHANT,
    receiver: 'store-1',
    storeId: 'store-1',
    transferToCents: null,
  })
}

const APPROVED: AuthorizationResult = {
  approved: true,
  gatewayTransactionId: '99',
  amountCents: 2000,
  authorizationCode: 'W99',
  cardBrand: 'Visa',
  lastDigits: 'XX11',
  message: null,
  raw: { statusCode: 3 },
}

describe('PaymentTransaction.start', () => {
  it('begins in the initiated state', () => {
    const transaction = buildTransaction()

    expect(transaction.status).toBe(PaymentTransactionStatus.INITIATED)
    expect(transaction.isSettled).toBe(false)
    expect(transaction.gatewayTransactionId).toBeNull()
  })

  it('carries the full amount breakdown', () => {
    const transaction = buildTransaction()

    expect(transaction.amountCents).toBe(2000)
    expect(transaction.commissionCents).toBe(115)
  })
})

describe('PaymentTransaction.markApproved', () => {
  it('records the gateway result and settles', () => {
    const transaction = buildTransaction()
    transaction.beginConfirmation()

    transaction.markApproved(APPROVED)

    expect(transaction.status).toBe(PaymentTransactionStatus.APPROVED)
    expect(transaction.gatewayTransactionId).toBe('99')
    expect(transaction.authorizationCode).toBe('W99')
    expect(transaction.lastDigits).toBe('XX11')
    expect(transaction.confirmedAt).toBeInstanceOf(Date)
    expect(transaction.isSettled).toBe(true)
  })

  it('keeps the raw payload for auditing', () => {
    const transaction = buildTransaction()

    transaction.markApproved(APPROVED)

    expect(transaction.confirmPayload).toEqual({ statusCode: 3 })
  })

  it('is idempotent and keeps the first confirmation time', () => {
    const transaction = buildTransaction()
    transaction.markApproved(APPROVED)
    const first = transaction.confirmedAt

    transaction.markApproved({ ...APPROVED, authorizationCode: 'W-OTHER' })

    expect(transaction.confirmedAt).toBe(first)
    expect(transaction.authorizationCode).toBe('W99')
  })
})

describe('PaymentTransaction.markDeclined', () => {
  it('stores the bank message and settles', () => {
    const transaction = buildTransaction()

    transaction.markDeclined({ ...APPROVED, approved: false, message: 'Fondos Insuficientes' })

    expect(transaction.status).toBe(PaymentTransactionStatus.DECLINED)
    expect(transaction.failureMessage).toBe('Fondos Insuficientes')
    expect(transaction.isSettled).toBe(true)
  })

  it('does not overwrite an approval', () => {
    const transaction = buildTransaction()
    transaction.markApproved(APPROVED)

    transaction.markDeclined({ ...APPROVED, approved: false, message: 'late' })

    expect(transaction.status).toBe(PaymentTransactionStatus.APPROVED)
  })
})

describe('PaymentTransaction.markExpired', () => {
  it('settles a transaction that was never confirmed', () => {
    const transaction = buildTransaction()

    transaction.markExpired()

    expect(transaction.status).toBe(PaymentTransactionStatus.EXPIRED)
    expect(transaction.isSettled).toBe(true)
  })

  it('leaves an approved transaction alone', () => {
    const transaction = buildTransaction()
    transaction.markApproved(APPROVED)

    transaction.markExpired()

    expect(transaction.status).toBe(PaymentTransactionStatus.APPROVED)
  })
})

describe('reviving an expired transaction', () => {
  it('lets markApproved move an expired transaction to approved', () => {
    const transaction = buildTransaction()
    transaction.markExpired()

    transaction.markApproved(APPROVED)

    expect(transaction.status).toBe(PaymentTransactionStatus.APPROVED)
    expect(transaction.gatewayTransactionId).toBe('99')
  })

  it('lets markDeclined move an expired transaction to declined', () => {
    const transaction = buildTransaction()
    transaction.markExpired()

    transaction.markDeclined({ ...APPROVED, approved: false, message: 'Fondos Insuficientes' })

    expect(transaction.status).toBe(PaymentTransactionStatus.DECLINED)
    expect(transaction.failureMessage).toBe('Fondos Insuficientes')
  })

  it('still refuses to move an approved transaction to declined', () => {
    const transaction = buildTransaction()
    transaction.markApproved(APPROVED)

    transaction.markDeclined({ ...APPROVED, approved: false, message: 'late' })

    expect(transaction.status).toBe(PaymentTransactionStatus.APPROVED)
  })

  it('still refuses to move a declined transaction to approved', () => {
    const transaction = buildTransaction()
    transaction.markDeclined({ ...APPROVED, approved: false, message: 'Fondos Insuficientes' })

    transaction.markApproved(APPROVED)

    expect(transaction.status).toBe(PaymentTransactionStatus.DECLINED)
  })
})

const MULTI_AMOUNTS = {
  amountCents: 3000,
  amountWithoutTaxCents: 3000,
  amountWithTaxCents: 0,
  taxCents: 0,
}

function startTransaction(orderIds: string[]) {
  return PaymentTransaction.start({
    orderIds,
    provider: 'payphone',
    clientTransactionId: 'tt-multi',
    amounts: MULTI_AMOUNTS,
    commissionCents: 173,
    mode: PaymentMode.OWN_MERCHANT,
    receiver: 'store-1',
    storeId: 'store-1',
    transferToCents: null,
  })
}

describe('PaymentTransaction', () => {
  it('starts covering every order it was given', () => {
    const transaction = startTransaction(['order-1', 'order-2'])

    expect(transaction.orderIds).toEqual(['order-1', 'order-2'])
    expect(transaction.status).toBe(PaymentTransactionStatus.INITIATED)
  })

  it('rejects an empty order set, since a payment with nothing to settle is meaningless', () => {
    expect(() => startTransaction([])).toThrow()
  })
})
