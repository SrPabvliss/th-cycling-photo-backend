import { SettleCartCommand } from '@cart/application/commands'
import { Logger } from '@nestjs/common'
import { SendDeliveryCommand } from '@orders/application/commands'
import { SellerAccountSuspension } from '@payments/application/services/seller-account-suspension.service'
import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import { AuditContext } from '@shared/application'
import { AppException } from '@shared/domain'
import type { AuthorizationResult } from '@shared/payment-gateways'
import { ConfirmPaymentTransactionCommand } from './confirm-payment-transaction.command'
import { ConfirmPaymentTransactionHandler } from './confirm-payment-transaction.handler'

const SELLER_TENANT = 'tenant-1'
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

const MERCHANT_CREDENTIALS = JSON.stringify({
  token: 'their-token',
  storeId: 'their-store-edited-after-the-intent',
})

type FixtureContext = {
  orderId: string
  status: string
  subtotalDollars: number | null
  sellerTenantId: string
  buyerUserId: string
}

function buildTransaction(overrides: Record<string, unknown> = {}) {
  return {
    orderIds: ['order-1'],
    provider: 'payphone',
    clientTransactionId: 'tx-1',
    amountCents: 2000,
    modeSnapshot: PaymentMode.OWN_MERCHANT,
    storeIdSnapshot: 'their-store',
    receiverSnapshot: 'their-store',
    status: PaymentTransactionStatus.INITIATED,
    isSettled: false,
    failureMessage: null,
    beginConfirmation: jest.fn(),
    markApproved: jest.fn(),
    markDeclined: jest.fn(),
    ...overrides,
  }
}

function buildContext(overrides: Partial<FixtureContext> = {}): FixtureContext {
  return {
    orderId: 'order-1',
    status: 'pending',
    subtotalDollars: 10,
    sellerTenantId: SELLER_TENANT,
    buyerUserId: BUYER,
    ...overrides,
  }
}

function buildHandler({
  transaction = buildTransaction(),
  contexts = [buildContext()],
  authorization = {},
}: {
  transaction?: ReturnType<typeof buildTransaction>
  contexts?: FixtureContext[]
  authorization?: Partial<AuthorizationResult>
} = {}) {
  const transactionRepo = {
    runLocked: jest.fn().mockImplementation((_id, work) => work(transaction)),
  }
  const payoutRepo = {
    findActivePayphoneForTenant: jest
      .fn()
      .mockResolvedValue({ credentialsEncrypted: 'cipher', deactivate: jest.fn() }),
    save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
  }
  const contextRepo = {
    findByOrderIds: jest.fn().mockResolvedValue(contexts),
  }
  const gateway = {
    provider: 'payphone',
    confirm: jest.fn().mockResolvedValue({ ...APPROVED, ...authorization }),
    buildCheckoutIntent: jest.fn(),
    verifyReceiver: jest.fn(),
    commissionCents: jest.fn(),
    platformCredentials: jest
      .fn()
      .mockReturnValue({ token: 'platform-token', storeId: 'platform-store-edited-later' }),
  }
  const registry = { get: jest.fn().mockReturnValue(gateway) }
  const cipher = { decrypt: jest.fn().mockReturnValue(MERCHANT_CREDENTIALS) }
  const commandBus = { execute: jest.fn().mockResolvedValue({ id: 'order-1' }) }
  const handler = new ConfirmPaymentTransactionHandler(
    transactionRepo as never,
    payoutRepo as never,
    contextRepo as never,
    registry as never,
    cipher as never,
    commandBus as never,
    new SellerAccountSuspension(payoutRepo as never),
    { userId: 'system-user-1' } as never,
  )

  return {
    handler,
    transaction,
    transactionRepo,
    payoutRepo,
    contextRepo,
    gateway,
    commandBus,
  }
}

const DELIVERY = {
  orderId: 'order-1',
  eventName: 'Vuelta al Cotopaxi',
  token: 'tok-1',
  deliveryUrl: 'https://titantv.test/delivery/tok-1',
}

const EXPECTED_DELIVERY = {
  orderId: DELIVERY.orderId,
  eventName: DELIVERY.eventName,
  token: DELIVERY.token,
}

function withDelivery(commandBus: { execute: jest.Mock }, deliveries = [DELIVERY]) {
  commandBus.execute.mockImplementation((command: { orderId?: string }) => {
    const match = deliveries.find((delivery) => delivery.orderId === command.orderId)
    if (command instanceof SendDeliveryCommand) {
      return match
        ? Promise.resolve({
            orderId: match.orderId,
            deliveryUrl: match.deliveryUrl,
            token: match.token,
            eventName: match.eventName,
            whatsappTemplate: 'plantilla',
          })
        : Promise.reject(new Error('not deliverable'))
    }
    return Promise.resolve({ id: command.orderId ?? 'order-1' })
  })
}

describe('ConfirmPaymentTransactionHandler', () => {
  it('confirms with the credential that created the transaction', async () => {
    const { handler, gateway } = buildHandler()

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(gateway.confirm).toHaveBeenCalledWith({
      gatewayTransactionId: '99',
      clientTransactionId: 'tx-1',
      credentials: { token: 'their-token', storeId: 'their-store' },
    })
  })

  it('marks the transaction approved and pays the order', async () => {
    const { handler, transaction, commandBus } = buildHandler()

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(transaction.markApproved).toHaveBeenCalledWith({ ...APPROVED })
    expect(commandBus.execute).toHaveBeenCalled()
    expect(result.approved).toBe(true)
    expect(result.orderIds).toEqual(['order-1'])
  })

  it('settles every order the transaction covers', async () => {
    const { handler, commandBus } = buildHandler({
      transaction: buildTransaction({ orderIds: ['order-1', 'order-2'], amountCents: 2500 }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'pending',
          subtotalDollars: 10,
          sellerTenantId: SELLER_TENANT,
          buyerUserId: BUYER,
        },
        {
          orderId: 'order-2',
          status: 'pending',
          subtotalDollars: 15,
          sellerTenantId: SELLER_TENANT,
          buyerUserId: BUYER,
        },
      ],
      authorization: { approved: true, amountCents: 2500 },
    })

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tt-multi', '900', BUYER),
    )

    expect(result.orderIds).toEqual(['order-1', 'order-2'])
    expect(commandBus.execute).toHaveBeenCalledTimes(5)
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: BUYER, orderIds: ['order-1', 'order-2'] }),
    )
  })

  it('settles the remaining orders when one of them was already settled elsewhere', async () => {
    const { handler, commandBus } = buildHandler({
      transaction: buildTransaction({ orderIds: ['order-1', 'order-2'], amountCents: 2500 }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'paid',
          subtotalDollars: 10,
          sellerTenantId: SELLER_TENANT,
          buyerUserId: BUYER,
        },
        {
          orderId: 'order-2',
          status: 'pending',
          subtotalDollars: 15,
          sellerTenantId: SELLER_TENANT,
          buyerUserId: BUYER,
        },
      ],
      authorization: { approved: true, amountCents: 2500 },
    })

    await handler.execute(new ConfirmPaymentTransactionCommand('tt-multi', '900', BUYER))

    expect(commandBus.execute).toHaveBeenCalledTimes(3)
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: BUYER, orderIds: ['order-2'] }),
    )
  })

  it('logs the unresolved order ids and still proceeds when the group only partially resolves', async () => {
    const { handler, contextRepo } = buildHandler({
      transaction: buildTransaction({ orderIds: ['order-1', 'order-2'], amountCents: 2500 }),
      authorization: { approved: true, amountCents: 2500 },
    })
    contextRepo.findByOrderIds.mockResolvedValue([buildContext({ orderId: 'order-1' })])
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tt-multi', '900', BUYER),
    )

    expect(result.approved).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('unresolvedOrderIds=order-2'))

    errorSpy.mockRestore()
  })

  it('does not log an error when a refresh re-settles a transaction whose orders are already all paid', async () => {
    const { handler, commandBus } = buildHandler({
      transaction: buildTransaction({ orderIds: ['order-1', 'order-2'], amountCents: 2500 }),
      contexts: [
        buildContext({ orderId: 'order-1', status: 'paid' }),
        buildContext({ orderId: 'order-2', status: 'paid' }),
      ],
      authorization: { approved: true, amountCents: 2500 },
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation()

    const result = await handler.execute(
      new ConfirmPaymentTransactionCommand('tt-multi', '900', BUYER),
    )

    expect(result.approved).toBe(true)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('orderId=order-1'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('orderId=order-2'))

    errorSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('marks a declined transaction without touching the order', async () => {
    const { handler, transaction, commandBus } = buildHandler({
      authorization: { approved: false, message: 'Fondos Insuficientes' },
    })

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(transaction.markDeclined).toHaveBeenCalled()
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(result.approved).toBe(false)
    expect(result.message).toBe('Fondos Insuficientes')
  })

  it('settles normally when the amount the gateway charged matches the transaction', async () => {
    const { handler, transaction, commandBus } = buildHandler({
      authorization: { amountCents: 2000 },
    })

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(transaction.markApproved).toHaveBeenCalled()
    expect(transaction.markDeclined).not.toHaveBeenCalled()
    expect(result.approved).toBe(true)
    expect(commandBus.execute).toHaveBeenCalled()
  })

  it('declines an approved payment charged for less than the order and never settles it', async () => {
    const { handler, transaction, commandBus } = buildHandler({
      authorization: { amountCents: 1 },
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(transaction.markApproved).not.toHaveBeenCalled()
    expect(transaction.markDeclined).toHaveBeenCalled()
    expect(result.approved).toBe(false)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('expectedAmountCents=2000 chargedAmountCents=1'),
    )

    errorSpy.mockRestore()
  })

  it('declines an approved payment charged for more than the order and never settles it', async () => {
    const { handler, transaction, commandBus } = buildHandler({
      authorization: { amountCents: 999_999 },
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(transaction.markApproved).not.toHaveBeenCalled()
    expect(transaction.markDeclined).toHaveBeenCalled()
    expect(result.approved).toBe(false)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('expectedAmountCents=2000 chargedAmountCents=999999'),
    )

    errorSpy.mockRestore()
  })

  it('logs the full group of order ids when the gateway amount does not match', async () => {
    const { handler } = buildHandler({
      transaction: buildTransaction({ orderIds: ['order-1', 'order-2'], amountCents: 2500 }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'pending',
          subtotalDollars: 10,
          sellerTenantId: SELLER_TENANT,
          buyerUserId: BUYER,
        },
        {
          orderId: 'order-2',
          status: 'pending',
          subtotalDollars: 15,
          sellerTenantId: SELLER_TENANT,
          buyerUserId: BUYER,
        },
      ],
      authorization: { amountCents: 1 },
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('orderIds=order-1,order-2'))

    errorSpy.mockRestore()
  })

  it('disables the seller account when the gateway rejects its credentials', async () => {
    const { handler, payoutRepo, gateway } = buildHandler()
    const account = { credentialsEncrypted: 'cipher', deactivate: jest.fn() }
    payoutRepo.findActivePayphoneForTenant.mockResolvedValue(account)
    gateway.confirm.mockRejectedValue(AppException.businessRule('payment.invalid_credentials'))
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.invalid_credentials' })

    expect(account.deactivate).toHaveBeenCalled()
    expect(payoutRepo.save).toHaveBeenCalledWith(account)

    errorSpy.mockRestore()
  })

  it('returns the earlier outcome when the transaction is already settled', async () => {
    const { handler, gateway } = buildHandler({
      transaction: buildTransaction({
        isSettled: true,
        status: PaymentTransactionStatus.APPROVED,
      }),
      contexts: [buildContext({ status: 'paid' })],
    })

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(gateway.confirm).not.toHaveBeenCalled()
    expect(result.approved).toBe(true)
  })

  it('does not pay the order twice when a settled transaction is re-confirmed', async () => {
    const { handler, commandBus } = buildHandler({
      transaction: buildTransaction({
        isSettled: true,
        status: PaymentTransactionStatus.DECLINED,
      }),
      contexts: [buildContext({ status: 'paid' })],
    })

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.approved).toBe(false)
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('calls the gateway inside the first lock, decides settlement inside a second lock, and dispatches the order command only after every lock has closed', async () => {
    const { handler, gateway, commandBus, transactionRepo, transaction } = buildHandler()
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
    transactionRepo.runLocked.mockImplementation(
      async (_id: string, work: (t: unknown) => unknown) => {
        lockCall += 1
        const label = lockCall
        callOrder.push(`lock-open-${label}`)
        const result = await work(transaction)
        callOrder.push(`lock-close-${label}`)
        return result
      },
    )

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(callOrder).toEqual([
      'lock-open-1',
      'gateway',
      'lock-close-1',
      'lock-open-2',
      'lock-close-2',
      'order-command',
      'order-command',
      'order-command',
    ])
  })

  it('still reports the payment approved when the order command fails, logging the failure instead of surfacing it', async () => {
    const { handler, commandBus } = buildHandler()
    commandBus.execute.mockRejectedValue(new Error('order module exploded'))
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.approved).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('could not settle its order'))

    errorSpy.mockRestore()
  })

  it('one order failing to settle does not prevent its siblings from settling', async () => {
    const { handler, commandBus } = buildHandler({
      transaction: buildTransaction({ orderIds: ['order-1', 'order-2'], amountCents: 2500 }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'pending',
          subtotalDollars: 10,
          sellerTenantId: SELLER_TENANT,
          buyerUserId: BUYER,
        },
        {
          orderId: 'order-2',
          status: 'pending',
          subtotalDollars: 15,
          sellerTenantId: SELLER_TENANT,
          buyerUserId: BUYER,
        },
      ],
      authorization: { amountCents: 2500 },
    })
    commandBus.execute.mockImplementation(async (command: { orderId: string }) => {
      if (command.orderId === 'order-1') throw new Error('order-1 module exploded')
      return { id: command.orderId }
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.approved).toBe(true)
    expect(commandBus.execute).toHaveBeenCalledTimes(4)
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: BUYER, orderIds: ['order-2'] }),
    )
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('orderId=order-1'))

    errorSpy.mockRestore()
  })

  it('enters the settlement lock even on the already-settled short-circuit path', async () => {
    const { handler, transactionRepo } = buildHandler({
      transaction: buildTransaction({
        isSettled: true,
        status: PaymentTransactionStatus.APPROVED,
      }),
    })

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(transactionRepo.runLocked).toHaveBeenCalledTimes(2)
    expect(transactionRepo.runLocked).toHaveBeenNthCalledWith(1, 'tx-1', expect.any(Function))
    expect(transactionRepo.runLocked).toHaveBeenNthCalledWith(2, 'tx-1', expect.any(Function))
  })

  it('serializes settlement so a concurrent confirmation dispatches the order command exactly once', async () => {
    const { handler, contextRepo, commandBus } = buildHandler({
      transaction: buildTransaction({
        isSettled: true,
        status: PaymentTransactionStatus.APPROVED,
      }),
    })
    contextRepo.findByOrderIds
      .mockResolvedValueOnce([buildContext({ status: 'pending' })])
      .mockResolvedValueOnce([buildContext({ status: 'pending' })])
      .mockResolvedValueOnce([buildContext({ status: 'pending' })])
      .mockResolvedValueOnce([buildContext({ status: 'paid' })])

    const [first, second] = await Promise.all([
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER)),
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER)),
    ])

    expect(first.approved).toBe(true)
    expect(second.approved).toBe(true)
    expect(commandBus.execute).toHaveBeenCalledTimes(3)
  })

  it('uses the platform token for a split transaction', async () => {
    const { handler, gateway } = buildHandler({
      transaction: buildTransaction({
        modeSnapshot: PaymentMode.SPLIT_RECEIVER,
        storeIdSnapshot: 'platform-store',
      }),
    })

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(gateway.confirm).toHaveBeenCalledWith({
      gatewayTransactionId: '99',
      clientTransactionId: 'tx-1',
      credentials: { token: 'platform-token', storeId: 'platform-store' },
    })
  })

  it('does not dispatch the order command when the order is already paid, and leaves no error trace', async () => {
    const { handler, commandBus } = buildHandler({
      contexts: [buildContext({ status: 'paid' })],
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation()

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.approved).toBe(true)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('orderStatus=paid'))

    errorSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('dispatches the order command when the order is pending', async () => {
    const { handler, commandBus } = buildHandler({
      contexts: [buildContext({ status: 'pending' })],
    })

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(commandBus.execute).toHaveBeenCalled()
  })

  it('settles the buyer cart with the settled order ids after paying the order', async () => {
    const { handler, commandBus } = buildHandler({
      contexts: [buildContext({ orderId: 'order-1', status: 'pending' })],
    })

    await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(commandBus.execute).toHaveBeenCalledWith(new SettleCartCommand(BUYER, ['order-1']))
  })

  it('self-heals: dispatches the order command for a settled-approved transaction whose order is still pending', async () => {
    const { handler, gateway, commandBus } = buildHandler({
      transaction: buildTransaction({
        isSettled: true,
        status: PaymentTransactionStatus.APPROVED,
      }),
      contexts: [buildContext({ status: 'pending' })],
    })

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(gateway.confirm).not.toHaveBeenCalled()
    expect(result.approved).toBe(true)
    expect(commandBus.execute).toHaveBeenCalled()
  })

  it('does not dispatch for a cancelled order and logs an error since the payment cannot settle', async () => {
    const { handler, commandBus } = buildHandler({
      contexts: [buildContext({ status: 'cancelled' })],
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.approved).toBe(true)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('orderStatus=cancelled'))

    errorSpy.mockRestore()
  })

  it('logs an error and still reports approved when the order context is missing at settlement time', async () => {
    const { handler, contextRepo, commandBus } = buildHandler()
    contextRepo.findByOrderIds
      .mockResolvedValueOnce([buildContext({ status: 'pending' })])
      .mockResolvedValueOnce([buildContext({ status: 'pending' })])
      .mockResolvedValueOnce([])
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.approved).toBe(true)
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no order context found'))

    errorSpy.mockRestore()
  })

  it('raises order_context_missing when the order context cannot be found', async () => {
    const { handler } = buildHandler({ contexts: [] })

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.order_context_missing' })
  })

  it('raises invalid_credentials when the account is missing', async () => {
    const { handler, payoutRepo } = buildHandler()
    payoutRepo.findActivePayphoneForTenant.mockResolvedValue(null)

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.invalid_credentials' })
  })

  it('raises invalid_credentials when the account has no credentials', async () => {
    const { handler, payoutRepo } = buildHandler()
    payoutRepo.findActivePayphoneForTenant.mockResolvedValue({
      credentialsEncrypted: null,
      deactivate: jest.fn(),
    })

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.invalid_credentials' })
  })

  it('propagates a gateway failure without settling anything', async () => {
    const { handler, gateway, transaction, commandBus } = buildHandler()
    const error = new Error('network down')
    gateway.confirm.mockRejectedValue(error)

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER)),
    ).rejects.toThrow('network down')
    expect(transaction.markApproved).not.toHaveBeenCalled()
    expect(transaction.markDeclined).not.toHaveBeenCalled()
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('rejects a confirmation for an order that belongs to another buyer before touching the gateway or the transaction', async () => {
    const { handler, gateway, transaction, commandBus } = buildHandler()

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'someone-else')),
    ).rejects.toMatchObject({ messageKey: 'payment.order_not_yours' })

    expect(gateway.confirm).not.toHaveBeenCalled()
    expect(transaction.beginConfirmation).not.toHaveBeenCalled()
    expect(transaction.markApproved).not.toHaveBeenCalled()
    expect(transaction.markDeclined).not.toHaveBeenCalled()
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('rejects a confirmation when only some orders in the group belong to the buyer', async () => {
    const { handler, commandBus } = buildHandler({
      transaction: buildTransaction({ orderIds: ['order-1', 'order-2'], amountCents: 2500 }),
      contexts: [
        buildContext({ orderId: 'order-1' }),
        buildContext({ orderId: 'order-2', buyerUserId: 'someone-else' }),
      ],
    })

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.order_not_yours' })

    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('revives an expired transaction the gateway now reports as approved, settling the orders and logging it', async () => {
    const { handler, transaction, commandBus } = buildHandler({
      transaction: buildTransaction({
        status: PaymentTransactionStatus.EXPIRED,
        isSettled: true,
      }),
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(transaction.markApproved).toHaveBeenCalledWith({ ...APPROVED })
    expect(commandBus.execute).toHaveBeenCalled()
    expect(result.approved).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('revived a transaction we had marked expired'),
    )
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('clientTransactionId=tx-1'))
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('orderIds=order-1'))

    errorSpy.mockRestore()
  })

  it('declines an expired transaction the gateway now reports as declined', async () => {
    const { handler, transaction, commandBus } = buildHandler({
      transaction: buildTransaction({
        status: PaymentTransactionStatus.EXPIRED,
        isSettled: true,
      }),
      authorization: { approved: false, message: 'Fondos Insuficientes' },
    })

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(transaction.markDeclined).toHaveBeenCalled()
    expect(transaction.markApproved).not.toHaveBeenCalled()
    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(result.approved).toBe(false)
    expect(result.message).toBe('Fondos Insuficientes')
  })

  it('still declines an expired transaction the gateway approves for the wrong amount', async () => {
    const { handler, transaction, commandBus } = buildHandler({
      transaction: buildTransaction({
        status: PaymentTransactionStatus.EXPIRED,
        isSettled: true,
      }),
      authorization: { amountCents: 1 },
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(transaction.markApproved).not.toHaveBeenCalled()
    expect(transaction.markDeclined).toHaveBeenCalled()
    expect(result.approved).toBe(false)
    expect(commandBus.execute).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('raises account_not_found instead of invalid_credentials when the order context has no seller', async () => {
    const { handler, contextRepo } = buildHandler()
    contextRepo.findByOrderIds.mockResolvedValue([buildContext({ sellerTenantId: null as never })])

    await expect(
      handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.account_not_found' })
  })

  it('rejects a non-owner reading an already-settled and approved transaction, disclosing no outcome', async () => {
    const { handler, commandBus } = buildHandler({
      transaction: buildTransaction({
        isSettled: true,
        status: PaymentTransactionStatus.APPROVED,
      }),
    })

    const call = handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', 'someone-else'))

    await expect(call).rejects.toMatchObject({ messageKey: 'payment.order_not_yours' })
    await expect(call).rejects.not.toHaveProperty('approved')
    await expect(call).rejects.not.toHaveProperty('orderIds')
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('delivers every order it settled and returns their links', async () => {
    const { handler, commandBus } = buildHandler({
      contexts: [buildContext({ orderId: 'order-1', status: 'pending' })],
    })
    withDelivery(commandBus)

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(commandBus.execute).toHaveBeenCalledWith(
      new SendDeliveryCommand('order-1', new AuditContext('system-user-1')),
    )
    expect(result.deliveries).toEqual([EXPECTED_DELIVERY])
  })

  it('never delivers an order that did not settle', async () => {
    const { handler, commandBus } = buildHandler({
      contexts: [buildContext({ orderId: 'order-1', status: 'cancelled' })],
    })
    withDelivery(commandBus)

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(commandBus.execute).not.toHaveBeenCalledWith(expect.any(SendDeliveryCommand))
    expect(result.deliveries).toEqual([])
  })

  it('still reports the payment approved when a delivery fails, logging it instead', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const { handler, commandBus } = buildHandler({
      contexts: [buildContext({ orderId: 'order-1', status: 'pending' })],
    })
    withDelivery(commandBus, [])

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.approved).toBe(true)
    expect(result.deliveries).toEqual([])
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('could not be delivered'))
    errorSpy.mockRestore()
  })

  it('delivers the sibling order when one delivery in a multi-order charge fails', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const { handler, commandBus } = buildHandler({
      transaction: buildTransaction({ orderIds: ['order-1', 'order-2'] }),
      contexts: [
        buildContext({ orderId: 'order-1', status: 'pending' }),
        buildContext({ orderId: 'order-2', status: 'pending' }),
      ],
    })
    withDelivery(commandBus, [DELIVERY])

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.approved).toBe(true)
    expect(result.deliveries).toEqual([EXPECTED_DELIVERY])
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('orderId=order-2'))

    errorSpy.mockRestore()
  })

  it('still delivers the order when settling the buyer cart fails', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const { handler, commandBus } = buildHandler({
      contexts: [buildContext({ orderId: 'order-1', status: 'pending' })],
    })
    commandBus.execute.mockImplementation((command: unknown) => {
      if (command instanceof SettleCartCommand) {
        return Promise.reject(new Error('cart module exploded'))
      }
      if (command instanceof SendDeliveryCommand) {
        return Promise.resolve({
          orderId: DELIVERY.orderId,
          deliveryUrl: DELIVERY.deliveryUrl,
          token: DELIVERY.token,
          eventName: DELIVERY.eventName,
          whatsappTemplate: 'plantilla',
        })
      }
      return Promise.resolve({ id: 'order-1' })
    })

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.approved).toBe(true)
    expect(result.deliveries).toEqual([EXPECTED_DELIVERY])
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("could not settle the buyer's cart"),
    )

    errorSpy.mockRestore()
  })

  it('delivers each order of a multi-event charge and returns one link per order', async () => {
    const secondDelivery = {
      orderId: 'order-2',
      eventName: 'Ruta de las Cascadas',
      token: 'tok-2',
      deliveryUrl: 'https://titantv.test/delivery/tok-2',
    }
    const { handler, commandBus } = buildHandler({
      transaction: buildTransaction({ orderIds: ['order-1', 'order-2'] }),
      contexts: [
        buildContext({ orderId: 'order-1', status: 'pending' }),
        buildContext({ orderId: 'order-2', status: 'pending' }),
      ],
    })
    withDelivery(commandBus, [DELIVERY, secondDelivery])

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.deliveries).toEqual([
      EXPECTED_DELIVERY,
      {
        orderId: secondDelivery.orderId,
        eventName: secondDelivery.eventName,
        token: secondDelivery.token,
      },
    ])
  })

  it('returns no deliveries when the payment was declined', async () => {
    const { handler } = buildHandler({ authorization: { approved: false, message: 'Rechazada' } })

    const result = await handler.execute(new ConfirmPaymentTransactionCommand('tx-1', '99', BUYER))

    expect(result.approved).toBe(false)
    expect(result.deliveries).toEqual([])
  })
})
