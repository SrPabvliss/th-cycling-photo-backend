import { Logger } from '@nestjs/common'
import { SellerAccountSuspension } from '@payments/application/services/seller-account-suspension.service'
import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import { AppException } from '@shared/domain'
import type { AuthorizationResult } from '@shared/payment-gateways'
import { ConfirmPaymentTransactionCommand } from './confirm-payment-transaction.command'
import { ConfirmPaymentTransactionHandler } from './confirm-payment-transaction.handler'

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

const MERCHANT_CREDENTIALS = JSON.stringify({
  token: 'their-token',
  storeId: 'their-store-edited-after-the-intent',
})

function buildTransaction(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 'order-1',
    provider: 'payphone',
    clientTransactionId: 'tx-1',
    amountCents: 2000,
    modeSnapshot: PaymentMode.OWN_MERCHANT,
    storeIdSnapshot: 'their-store',
    receiverSnapshot: 'their-store',
    status: PaymentTransactionStatus.INITIATED,
    isSettled: false,
    beginConfirmation: jest.fn(),
    markApproved: jest.fn(),
    markDeclined: jest.fn(),
    ...overrides,
  }
}

describe('ConfirmPaymentTransactionHandler', () => {
  let transactionRepo: { runLocked: jest.Mock }
  let accountRepo: { findByUserId: jest.Mock }
  let accountWriteRepo: { save: jest.Mock }
  let contextRepo: { findByOrderId: jest.Mock }
  let gateway: {
    provider: string
    confirm: jest.Mock
    buildCheckoutIntent: jest.Mock
    verifyReceiver: jest.Mock
    commissionCents: jest.Mock
    platformCredentials: jest.Mock
  }
  let registry: { get: jest.Mock }
  let cipher: { decrypt: jest.Mock }
  let commandBus: { execute: jest.Mock }
  let config: { getOrThrow: jest.Mock; get: jest.Mock }
  let handler: ConfirmPaymentTransactionHandler
  let transaction: ReturnType<typeof buildTransaction>

  beforeEach(() => {
    transaction = buildTransaction()
    transactionRepo = {
      runLocked: jest.fn().mockImplementation((_id, work) => work(transaction)),
    }
    accountRepo = {
      findByUserId: jest
        .fn()
        .mockResolvedValue({ credentialsEncrypted: 'cipher', disable: jest.fn() }),
    }
    accountWriteRepo = { save: jest.fn().mockImplementation((a) => Promise.resolve(a)) }
    contextRepo = {
      findByOrderId: jest
        .fn()
        .mockResolvedValue({ sellerUserId: 'seller-1', buyerUserId: 'buyer-1', status: 'pending' }),
    }
    gateway = {
      provider: 'payphone',
      confirm: jest.fn().mockResolvedValue(APPROVED),
      buildCheckoutIntent: jest.fn(),
      verifyReceiver: jest.fn(),
      commissionCents: jest.fn(),
      platformCredentials: jest
        .fn()
        .mockReturnValue({ token: 'platform-token', storeId: 'platform-store-edited-later' }),
    }
    registry = { get: jest.fn().mockReturnValue(gateway) }
    cipher = { decrypt: jest.fn().mockReturnValue(MERCHANT_CREDENTIALS) }
    commandBus = { execute: jest.fn().mockResolvedValue({ id: 'order-1' }) }
    config = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'payments.systemUserId') return 'system-user-1'
        return undefined
      }),
      get: jest.fn(),
    }

    handler = new ConfirmPaymentTransactionHandler(
      transactionRepo as never,
      accountRepo as never,
      contextRepo as never,
      registry as never,
      cipher as never,
      commandBus as never,
      config as never,
      new SellerAccountSuspension(accountRepo as never, accountWriteRepo as never),
    )
  })

  it('confirms with the credential that created the transaction', async () => {
    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'))

    expect(gateway.confirm).toHaveBeenCalledWith({
      gatewayTransactionId: '99',
      clientTransactionId: 'tx-1',
      credentials: { token: 'their-token', storeId: 'their-store' },
    })
  })

  it('marks the transaction approved and pays the order', async () => {
    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(transaction.markApproved).toHaveBeenCalledWith(APPROVED)
    expect(commandBus.execute).toHaveBeenCalled()
    expect(result.approved).toBe(true)
    expect(result.orderId).toBe('order-1')
  })

  it('marks a declined transaction without touching the order', async () => {
    gateway.confirm.mockResolvedValue({
      ...APPROVED,
      approved: false,
      message: 'Fondos Insuficientes',
    })

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(transaction.markDeclined).toHaveBeenCalled()
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(result.approved).toBe(false)
    expect(result.message).toBe('Fondos Insuficientes')
  })

  it('settles normally when the amount the gateway charged matches the transaction', async () => {
    gateway.confirm.mockResolvedValue({ ...APPROVED, amountCents: 2000 })

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(transaction.markApproved).toHaveBeenCalled()
    expect(transaction.markDeclined).not.toHaveBeenCalled()
    expect(result.approved).toBe(true)
    expect(commandBus.execute).toHaveBeenCalled()
  })

  it('declines an approved payment charged for less than the order and never settles it', async () => {
    const tampered = { ...APPROVED, amountCents: 1 }
    gateway.confirm.mockResolvedValue(tampered)
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(transaction.markApproved).not.toHaveBeenCalled()
    expect(transaction.markDeclined).toHaveBeenCalledWith(tampered)
    expect(result.approved).toBe(false)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('expectedAmountCents=2000 chargedAmountCents=1'),
    )

    errorSpy.mockRestore()
  })

  it('declines an approved payment charged for more than the order and never settles it', async () => {
    const tampered = { ...APPROVED, amountCents: 999_999 }
    gateway.confirm.mockResolvedValue(tampered)
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(transaction.markApproved).not.toHaveBeenCalled()
    expect(transaction.markDeclined).toHaveBeenCalledWith(tampered)
    expect(result.approved).toBe(false)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('expectedAmountCents=2000 chargedAmountCents=999999'),
    )

    errorSpy.mockRestore()
  })

  it('disables the seller account when the gateway rejects its credentials', async () => {
    const account = { credentialsEncrypted: 'cipher', disable: jest.fn() }
    accountRepo.findByUserId.mockResolvedValue(account)
    gateway.confirm.mockRejectedValue(AppException.businessRule('payment.invalid_credentials'))
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1')),
    ).rejects.toMatchObject({ messageKey: 'payment.invalid_credentials' })

    expect(account.disable).toHaveBeenCalled()
    expect(accountWriteRepo.save).toHaveBeenCalledWith(account)

    errorSpy.mockRestore()
  })

  it('returns the earlier outcome when the transaction is already settled', async () => {
    contextRepo.findByOrderId.mockResolvedValue({
      sellerUserId: 'seller-1',
      buyerUserId: 'buyer-1',
      status: 'paid',
    })
    transaction = buildTransaction({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
    })
    transactionRepo.runLocked.mockImplementation((_id, work) => work(transaction))

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(gateway.confirm).not.toHaveBeenCalled()
    expect(result.approved).toBe(true)
  })

  it('does not pay the order twice when a settled transaction is re-confirmed', async () => {
    contextRepo.findByOrderId.mockResolvedValue({
      sellerUserId: 'seller-1',
      buyerUserId: 'buyer-1',
      status: 'paid',
    })
    transaction = buildTransaction({
      isSettled: true,
      status: PaymentTransactionStatus.DECLINED,
    })
    transactionRepo.runLocked.mockImplementation((_id, work) => work(transaction))

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(result.approved).toBe(false)
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('calls the gateway inside the first lock, decides settlement inside a second lock, and dispatches the order command only after every lock has closed', async () => {
    const callOrder: string[] = []
    gateway.confirm.mockImplementation(async () => {
      callOrder.push('gateway')
      return APPROVED
    })
    commandBus.execute.mockImplementation(async () => {
      callOrder.push('order-command')
      return { id: 'order-1' }
    })
    let lockCall = 0
    transactionRepo.runLocked.mockImplementation(async (_id, work) => {
      lockCall += 1
      const label = lockCall
      callOrder.push(`lock-open-${label}`)
      const result = await work(transaction)
      callOrder.push(`lock-close-${label}`)
      return result
    })

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'))

    expect(callOrder).toEqual([
      'lock-open-1',
      'gateway',
      'lock-close-1',
      'lock-open-2',
      'lock-close-2',
      'order-command',
    ])
  })

  it('still reports the payment approved when the order command fails, logging the failure instead of surfacing it', async () => {
    commandBus.execute.mockRejectedValue(new Error('order module exploded'))
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(result.approved).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('could not settle its order'))

    errorSpy.mockRestore()
  })

  it('enters the settlement lock even on the already-settled short-circuit path', async () => {
    transaction = buildTransaction({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
    })
    transactionRepo.runLocked.mockImplementation((_id, work) => work(transaction))

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'))

    expect(transactionRepo.runLocked).toHaveBeenCalledTimes(2)
    expect(transactionRepo.runLocked).toHaveBeenNthCalledWith(1, 'tx-1', expect.any(Function))
    expect(transactionRepo.runLocked).toHaveBeenNthCalledWith(2, 'tx-1', expect.any(Function))
  })

  it('serializes settlement so a concurrent confirmation dispatches the order command exactly once', async () => {
    transaction = buildTransaction({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
    })
    transactionRepo.runLocked.mockImplementation((_id, work) => work(transaction))
    contextRepo.findByOrderId
      .mockResolvedValueOnce({
        sellerUserId: 'seller-1',
        buyerUserId: 'buyer-1',
        status: 'pending',
      })
      .mockResolvedValueOnce({
        sellerUserId: 'seller-1',
        buyerUserId: 'buyer-1',
        status: 'pending',
      })
      .mockResolvedValueOnce({
        sellerUserId: 'seller-1',
        buyerUserId: 'buyer-1',
        status: 'pending',
      })
      .mockResolvedValueOnce({ sellerUserId: 'seller-1', buyerUserId: 'buyer-1', status: 'paid' })

    const [first, second] = await Promise.all([
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1')),
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1')),
    ])

    expect(first.approved).toBe(true)
    expect(second.approved).toBe(true)
    expect(commandBus.execute).toHaveBeenCalledTimes(1)
  })

  it('uses the platform token for a split transaction', async () => {
    transaction = buildTransaction({
      modeSnapshot: PaymentMode.SPLIT_RECEIVER,
      storeIdSnapshot: 'platform-store',
    })
    transactionRepo.runLocked.mockImplementation((_id, work) => work(transaction))

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'))

    expect(gateway.confirm).toHaveBeenCalledWith({
      gatewayTransactionId: '99',
      clientTransactionId: 'tx-1',
      credentials: { token: 'platform-token', storeId: 'platform-store' },
    })
  })

  it('does not dispatch the order command when the order is already paid, but leaves an error trace', async () => {
    contextRepo.findByOrderId.mockResolvedValue({
      sellerUserId: 'seller-1',
      buyerUserId: 'buyer-1',
      status: 'paid',
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(result.approved).toBe(true)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('order that is already settled'))

    errorSpy.mockRestore()
  })

  it('dispatches the order command when the order is pending', async () => {
    contextRepo.findByOrderId.mockResolvedValue({
      sellerUserId: 'seller-1',
      buyerUserId: 'buyer-1',
      status: 'pending',
    })

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'))

    expect(commandBus.execute).toHaveBeenCalled()
  })

  it('self-heals: dispatches the order command for a settled-approved transaction whose order is still pending', async () => {
    transaction = buildTransaction({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
    })
    transactionRepo.runLocked.mockImplementation((_id, work) => work(transaction))
    contextRepo.findByOrderId.mockResolvedValue({
      sellerUserId: 'seller-1',
      buyerUserId: 'buyer-1',
      status: 'pending',
    })

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(gateway.confirm).not.toHaveBeenCalled()
    expect(result.approved).toBe(true)
    expect(commandBus.execute).toHaveBeenCalled()
  })

  it('does not dispatch for a cancelled order and logs an error since the payment cannot settle', async () => {
    contextRepo.findByOrderId.mockResolvedValue({
      sellerUserId: 'seller-1',
      buyerUserId: 'buyer-1',
      status: 'cancelled',
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(result.approved).toBe(true)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('does not allow settlement'))

    errorSpy.mockRestore()
  })

  it('logs an error and still reports approved when the order context is missing at settlement time', async () => {
    contextRepo.findByOrderId
      .mockResolvedValueOnce({
        sellerUserId: 'seller-1',
        buyerUserId: 'buyer-1',
        status: 'pending',
      })
      .mockResolvedValueOnce({
        sellerUserId: 'seller-1',
        buyerUserId: 'buyer-1',
        status: 'pending',
      })
      .mockResolvedValueOnce(null)
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1'),
    )

    expect(result.approved).toBe(true)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no order context found'))

    errorSpy.mockRestore()
  })

  it('raises order_context_missing when the order context cannot be found', async () => {
    contextRepo.findByOrderId.mockResolvedValue(null)

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1')),
    ).rejects.toMatchObject({ messageKey: 'payment.order_context_missing' })
  })

  it('raises invalid_credentials when the account is missing', async () => {
    accountRepo.findByUserId.mockResolvedValue(null)

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1')),
    ).rejects.toMatchObject({ messageKey: 'payment.invalid_credentials' })
  })

  it('raises invalid_credentials when the account has no credentials', async () => {
    accountRepo.findByUserId.mockResolvedValue({
      credentialsEncrypted: null,
      disable: jest.fn(),
    })

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1')),
    ).rejects.toMatchObject({ messageKey: 'payment.invalid_credentials' })
  })

  it('propagates a gateway failure without settling anything', async () => {
    const error = new Error('network down')
    gateway.confirm.mockRejectedValue(error)

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'buyer-1')),
    ).rejects.toThrow('network down')
    expect(transaction.markApproved).not.toHaveBeenCalled()
    expect(transaction.markDeclined).not.toHaveBeenCalled()
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('rejects a confirmation for an order that belongs to another buyer before touching the gateway or the transaction', async () => {
    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'someone-else')),
    ).rejects.toMatchObject({ messageKey: 'payment.order_not_yours' })

    expect(gateway.confirm).not.toHaveBeenCalled()
    expect(transaction.beginConfirmation).not.toHaveBeenCalled()
    expect(transaction.markApproved).not.toHaveBeenCalled()
    expect(transaction.markDeclined).not.toHaveBeenCalled()
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('rejects a non-owner reading an already-settled and approved transaction, disclosing no outcome', async () => {
    transaction = buildTransaction({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
      failureMessage: null,
    })
    transactionRepo.runLocked.mockImplementation((_id, work) => work(transaction))

    const call = handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'someone-else'))

    await expect(call).rejects.toMatchObject({ messageKey: 'payment.order_not_yours' })
    await expect(call).rejects.not.toHaveProperty('approved')
    await expect(call).rejects.not.toHaveProperty('orderId')
    expect(commandBus.execute).not.toHaveBeenCalled()
  })
})
