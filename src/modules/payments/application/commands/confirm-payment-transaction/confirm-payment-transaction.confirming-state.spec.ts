import { SellerAccountSuspension } from '@payments/application/services/seller-account-suspension.service'
import { PaymentTransaction } from '@payments/domain/entities'
import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import {
  PaymentTransactionStatus,
  type PaymentTransactionStatusType,
} from '@payments/domain/value-objects/payment-transaction-status.vo'
import type { AuthorizationResult } from '@shared/payment-gateways'
import { ConfirmPaymentTransactionCommand } from './confirm-payment-transaction.command'
import { ConfirmPaymentTransactionHandler } from './confirm-payment-transaction.handler'

const BUYER = 'buyer-1'

const APPROVED: AuthorizationResult = {
  approved: true,
  gatewayTransactionId: '99',
  amountCents: 2000,
  authorizationCode: 'W99',
  cardBrand: 'Visa',
  lastDigits: 'XX11',
  message: null,
  raw: {},
}

/**
 * A repository double with the two properties of the real one that this behaviour depends on:
 * a lock that serializes every `runLocked` on the transaction, and all-or-nothing persistence —
 * what `work` did to the entity is stored only when it returns, and discarded when it throws.
 */
class LockingTransactionStore {
  private stored: PaymentTransaction
  private tail: Promise<unknown> = Promise.resolve()
  readonly committedStatuses: PaymentTransactionStatusType[] = []

  constructor(status: PaymentTransactionStatusType) {
    this.stored = PaymentTransaction.fromPersistence({
      id: 'transaction-1',
      orderIds: ['order-1'],
      provider: 'payphone',
      clientTransactionId: 'tx-1',
      gatewayTransactionId: null,
      status,
      amountCents: 2000,
      amountWithoutTaxCents: 2000,
      amountWithTaxCents: 0,
      taxCents: 0,
      commissionCents: 100,
      transferToCents: null,
      modeSnapshot: PaymentMode.SPLIT_RECEIVER,
      receiverSnapshot: '0991234567',
      storeIdSnapshot: 'store-1',
      authorizationCode: null,
      cardBrand: null,
      lastDigits: null,
      confirmPayload: null,
      failureMessage: null,
      confirmedAt: null,
      createdAt: new Date('2026-11-12T12:00:00Z'),
    })
  }

  get status(): PaymentTransactionStatusType {
    return this.stored.status
  }

  runLocked = <T>(
    _id: string,
    work: (transaction: PaymentTransaction) => Promise<T>,
  ): Promise<T> => {
    const run = this.tail.then(async () => {
      const working = Object.assign(
        Object.create(PaymentTransaction.prototype),
        this.stored,
      ) as PaymentTransaction
      const result = await work(working)
      this.stored = working
      this.committedStatuses.push(working.status)
      return result
    })
    this.tail = run.catch(() => undefined)
    return run
  }
}

function setup(initialStatus: PaymentTransactionStatusType = PaymentTransactionStatus.INITIATED) {
  const store = new LockingTransactionStore(initialStatus)
  const order = { status: 'draft' }

  const contextRepo = {
    findByOrderIds: jest.fn(async () => [
      {
        orderId: 'order-1',
        status: order.status,
        subtotalDollars: 20,
        sellerTenantId: 'tenant-1',
        buyerUserId: BUYER,
      },
    ]),
  }
  const gateway = {
    provider: 'payphone',
    confirm: jest.fn().mockResolvedValue({ ...APPROVED }),
    platformCredentials: jest.fn().mockReturnValue({ token: 'platform-token' }),
  }
  const payOrder = jest.fn()
  const commandBus = {
    execute: jest.fn(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === 'ConfirmOrderPaymentCommand') {
        payOrder()
        order.status = 'paid'
      }
      return { id: 'order-1' }
    }),
  }
  const payoutRepo = { findActivePayphoneForTenant: jest.fn(), save: jest.fn() }

  const handler = new ConfirmPaymentTransactionHandler(
    { runLocked: store.runLocked } as never,
    payoutRepo as never,
    contextRepo as never,
    { get: () => gateway } as never,
    { decrypt: jest.fn() } as never,
    commandBus as never,
    new SellerAccountSuspension(payoutRepo as never),
    { userId: 'system-user-1' } as never,
  )

  const confirm = (buyer = BUYER) =>
    handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', buyer))

  return { store, order, gateway, payOrder, confirm }
}

describe('ConfirmPaymentTransactionHandler — the confirming state is persisted', () => {
  it('stores confirming before the gateway is asked', async () => {
    const { store, gateway, confirm } = setup()
    let statusSeenByGateway: PaymentTransactionStatusType | null = null
    gateway.confirm.mockImplementation(async () => {
      statusSeenByGateway = store.status
      return { ...APPROVED }
    })

    await confirm()

    expect(statusSeenByGateway).toBe(PaymentTransactionStatus.CONFIRMING)
    expect(store.committedStatuses.slice(0, 2)).toEqual([
      PaymentTransactionStatus.CONFIRMING,
      PaymentTransactionStatus.APPROVED,
    ])
  })

  it('leaves the transaction confirming, and the order a draft, when the gateway throws', async () => {
    const { store, order, gateway, payOrder, confirm } = setup()
    gateway.confirm.mockRejectedValue(new Error('gateway timeout'))

    await expect(confirm()).rejects.toThrow('gateway timeout')

    expect(store.status).toBe(PaymentTransactionStatus.CONFIRMING)
    expect(order.status).toBe('draft')
    expect(payOrder).not.toHaveBeenCalled()
  })

  it('can be retried after a gateway failure and then settles the order', async () => {
    const { store, order, gateway, payOrder, confirm } = setup()
    gateway.confirm.mockRejectedValueOnce(new Error('gateway timeout'))

    await expect(confirm()).rejects.toThrow('gateway timeout')
    const result = await confirm()

    expect(result.approved).toBe(true)
    expect(result.settled).toBe(true)
    expect(store.status).toBe(PaymentTransactionStatus.APPROVED)
    expect(order.status).toBe('paid')
    expect(gateway.confirm).toHaveBeenCalledTimes(2)
    expect(payOrder).toHaveBeenCalledTimes(1)
  })

  it('settles the order exactly once when the payment is approved', async () => {
    const { store, order, payOrder, confirm } = setup()

    const result = await confirm()

    expect(result).toMatchObject({ approved: true, settled: true, orderIds: ['order-1'] })
    expect(store.status).toBe(PaymentTransactionStatus.APPROVED)
    expect(order.status).toBe('paid')
    expect(payOrder).toHaveBeenCalledTimes(1)
  })

  it('does not settle when the payment is declined, and stores the decline', async () => {
    const { store, order, gateway, payOrder, confirm } = setup()
    gateway.confirm.mockResolvedValue({
      ...APPROVED,
      approved: false,
      message: 'Fondos Insuficientes',
    })

    const result = await confirm()

    expect(result).toMatchObject({
      approved: false,
      settled: false,
      message: 'Fondos Insuficientes',
    })
    expect(store.status).toBe(PaymentTransactionStatus.DECLINED)
    expect(order.status).toBe('draft')
    expect(payOrder).not.toHaveBeenCalled()
  })

  it('asks the gateway once when a second confirmation arrives while the first is in flight', async () => {
    const { store, gateway, payOrder, confirm } = setup()
    let releaseGateway: (value: AuthorizationResult) => void = () => undefined
    const gatewayEntered = new Promise<void>((entered) => {
      gateway.confirm.mockImplementationOnce(
        () =>
          new Promise<AuthorizationResult>((resolve) => {
            releaseGateway = resolve
            entered()
          }),
      )
    })

    const first = confirm()
    await gatewayEntered
    const second = confirm()
    // The second confirmation is now queued behind the row lock the first one holds.
    await new Promise((resolve) => setImmediate(resolve))
    expect(gateway.confirm).toHaveBeenCalledTimes(1)
    expect(store.status).toBe(PaymentTransactionStatus.CONFIRMING)

    releaseGateway({ ...APPROVED })
    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(gateway.confirm).toHaveBeenCalledTimes(1)
    expect(firstResult.approved).toBe(true)
    expect(secondResult.approved).toBe(true)
    expect(payOrder).toHaveBeenCalledTimes(1)
  })

  it('never marks the transaction confirming for someone who does not own the order', async () => {
    const { store, gateway, confirm } = setup()

    await expect(confirm('someone-else')).rejects.toMatchObject({
      messageKey: 'payment.order_not_yours',
    })

    expect(store.status).toBe(PaymentTransactionStatus.INITIATED)
    expect(gateway.confirm).not.toHaveBeenCalled()
  })

  it('answers an already-approved transaction without asking the gateway again', async () => {
    const { store, gateway, confirm } = setup(PaymentTransactionStatus.APPROVED)

    const result = await confirm()

    expect(result.approved).toBe(true)
    expect(gateway.confirm).not.toHaveBeenCalled()
    expect(store.status).toBe(PaymentTransactionStatus.APPROVED)
  })

  it('still asks the gateway about a transaction the sweep expired, and revives it if approved', async () => {
    const { store, gateway, order, confirm } = setup(PaymentTransactionStatus.EXPIRED)

    const result = await confirm()

    expect(gateway.confirm).toHaveBeenCalledTimes(1)
    expect(result.approved).toBe(true)
    expect(store.status).toBe(PaymentTransactionStatus.APPROVED)
    expect(order.status).toBe('paid')
  })
})
