import { SellerAccountSuspension } from '@payments/application/services/seller-account-suspension.service'
import { PaymentAmountCalculator } from '@payments/domain/services/payment-amount-calculator.service'
import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { AppException } from '@shared/domain'
import type { CheckoutIntentInput } from '@shared/payment-gateways'
import { CreatePaymentIntentCommand } from './create-payment-intent.command'
import { CreatePaymentIntentHandler } from './create-payment-intent.handler'

const BUYER = 'buyer-1'

const CONTEXT = {
  orderId: 'order-1',
  status: 'pending',
  subtotalDollars: 20,
  sellerUserId: 'seller-1',
  buyerUserId: BUYER,
}

const MERCHANT_CREDENTIALS = JSON.stringify({ token: 'their-token', storeId: 'their-store-live' })

const merchantAccount = {
  provider: 'payphone',
  mode: PaymentMode.OWN_MERCHANT,
  isUsable: true,
  credentialsEncrypted: 'cipher',
  receiverIdentifier: null,
  disable: jest.fn(),
}

type FixtureContext = {
  orderId: string
  status: string
  subtotalDollars: number | null
  sellerUserId: string | null
  buyerUserId: string
}

function buildGateway() {
  return {
    provider: 'payphone',
    buildCheckoutIntent: jest.fn().mockImplementation((input: CheckoutIntentInput) => ({
      provider: 'payphone',
      payload: {
        token: input.credentials.token,
        storeId: input.credentials.storeId,
        clientTransactionId: input.clientTransactionId,
        amount: input.amounts.amountCents,
        amountWithoutTax: input.amounts.amountWithoutTaxCents,
        amountWithTax: input.amounts.amountWithTaxCents,
        tax: input.amounts.taxCents,
        currency: input.currency,
        reference: input.reference,
        ...(input.transferableCents !== null ? { transferTo: 'encrypted' } : {}),
      },
    })),
    confirm: jest.fn(),
    verifyReceiver: jest.fn(),
    commissionCents: jest.fn().mockImplementation((cents: number) => Math.ceil(cents * 0.0575)),
    platformCredentials: jest
      .fn()
      .mockReturnValue({ token: 'platform-token', storeId: 'platform-store' }),
  }
}

function buildHandler({ contexts }: { contexts: FixtureContext[] }) {
  const contextRepo = { findByOrderIds: jest.fn().mockResolvedValue(contexts) }
  const accountRepo = { findByUserId: jest.fn().mockResolvedValue(merchantAccount) }
  const accountWriteRepo = { save: jest.fn().mockImplementation((a) => Promise.resolve(a)) }
  const transactionRepo = { save: jest.fn().mockImplementation((t) => Promise.resolve(t)) }
  const gateway = buildGateway()
  const registry = { get: jest.fn().mockReturnValue(gateway) }
  const cipher = { decrypt: jest.fn().mockReturnValue(MERCHANT_CREDENTIALS) }
  const config = {
    get: jest.fn().mockImplementation((key: string) => (key === 'payments.taxRate' ? 0 : false)),
    getOrThrow: jest.fn().mockReturnValue('platform-token'),
  }
  const scheduler = { schedule: jest.fn() }
  const handler = new CreatePaymentIntentHandler(
    contextRepo as never,
    accountRepo as never,
    transactionRepo as never,
    registry as never,
    new PaymentAmountCalculator(),
    cipher as never,
    config as never,
    scheduler as never,
    new SellerAccountSuspension(accountRepo as never, accountWriteRepo as never),
  )

  return { handler, transactionRepo, contextRepo, accountRepo, gateway, scheduler }
}

describe('CreatePaymentIntentHandler', () => {
  let contextRepo: { findByOrderIds: jest.Mock }
  let accountRepo: { findByUserId: jest.Mock }
  let accountWriteRepo: { save: jest.Mock }
  let transactionRepo: { save: jest.Mock }
  let gateway: {
    provider: string
    buildCheckoutIntent: jest.Mock
    confirm: jest.Mock
    verifyReceiver: jest.Mock
    commissionCents: jest.Mock
    platformCredentials: jest.Mock
  }
  let registry: { get: jest.Mock }
  let cipher: { decrypt: jest.Mock }
  let config: { get: jest.Mock; getOrThrow: jest.Mock }
  let scheduler: { schedule: jest.Mock }
  let handler: CreatePaymentIntentHandler

  const splitAccount = {
    provider: 'payphone',
    mode: PaymentMode.SPLIT_RECEIVER,
    isUsable: true,
    credentialsEncrypted: null,
    receiverIdentifier: '984112233',
  }

  beforeEach(() => {
    merchantAccount.disable.mockClear()
    contextRepo = { findByOrderIds: jest.fn().mockResolvedValue([CONTEXT]) }
    accountRepo = { findByUserId: jest.fn().mockResolvedValue(merchantAccount) }
    accountWriteRepo = { save: jest.fn().mockImplementation((a) => Promise.resolve(a)) }
    transactionRepo = { save: jest.fn().mockImplementation((t) => Promise.resolve(t)) }
    gateway = buildGateway()
    registry = { get: jest.fn().mockReturnValue(gateway) }
    cipher = { decrypt: jest.fn().mockReturnValue(MERCHANT_CREDENTIALS) }
    config = {
      get: jest.fn().mockImplementation((key: string) => (key === 'payments.taxRate' ? 0 : false)),
      getOrThrow: jest.fn().mockReturnValue('platform-token'),
    }
    scheduler = { schedule: jest.fn() }
    handler = new CreatePaymentIntentHandler(
      contextRepo as never,
      accountRepo as never,
      transactionRepo as never,
      registry as never,
      new PaymentAmountCalculator(),
      cipher as never,
      config as never,
      scheduler as never,
      new SellerAccountSuspension(accountRepo as never, accountWriteRepo as never),
    )
  })

  it('returns the merchant token and store id in merchant mode', async () => {
    const intent = await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))

    expect(intent.provider).toBe('payphone')
    expect(intent.payload.token).toBe('their-token')
    expect(intent.payload.storeId).toBe('their-store-live')
  })

  it('returns the amount breakdown in cents', async () => {
    const intent = await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))

    expect(intent.payload.amount).toBe(2000)
    expect(intent.payload.amountWithoutTax).toBe(2000)
    expect(intent.payload.tax).toBe(0)
    expect(intent.payload.currency).toBe('USD')
  })

  it('generates a client transaction id within the 50 character limit', async () => {
    const intent = await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))

    const clientTransactionId = intent.payload.clientTransactionId as string
    expect(clientTransactionId.length).toBeLessThanOrEqual(50)
    expect(clientTransactionId.length).toBeGreaterThan(8)
  })

  it('persists an initiated transaction with the receiver snapshot', async () => {
    await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))

    const saved = transactionRepo.save.mock.calls[0][0]
    expect(saved.orderIds).toEqual(['order-1'])
    expect(saved.provider).toBe('payphone')
    expect(saved.receiverSnapshot).toBe('their-store-live')
    expect(saved.storeIdSnapshot).toBe('their-store-live')
    expect(saved.transferToCents).toBeNull()
  })

  it('refuses an order that is not pending', async () => {
    contextRepo.findByOrderIds.mockResolvedValue([{ ...CONTEXT, status: 'paid' }])

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER)),
    ).rejects.toThrow(AppException)
  })

  it('refuses an order with no subtotal', async () => {
    contextRepo.findByOrderIds.mockResolvedValue([{ ...CONTEXT, subtotalDollars: null }])

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER)),
    ).rejects.toThrow(AppException)
  })

  it('refuses when the seller has no account', async () => {
    accountRepo.findByUserId.mockResolvedValue(null)

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER)),
    ).rejects.toThrow(AppException)
  })

  it('refuses when the seller account is not verified', async () => {
    accountRepo.findByUserId.mockResolvedValue({ ...merchantAccount, isUsable: false })

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER)),
    ).rejects.toThrow(AppException)
  })

  it('propagates a gateway refusal', async () => {
    accountRepo.findByUserId.mockResolvedValue(splitAccount)
    gateway.buildCheckoutIntent.mockImplementation(() => {
      throw AppException.businessRule('payment.split_not_enabled')
    })

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.split_not_enabled' })
  })

  it('does not persist a transaction or schedule a sweep when the gateway rejects the intent', async () => {
    accountRepo.findByUserId.mockResolvedValue(splitAccount)
    gateway.buildCheckoutIntent.mockImplementation(() => {
      throw AppException.businessRule('payment.split_not_enabled')
    })

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.split_not_enabled' })

    expect(transactionRepo.save).not.toHaveBeenCalled()
    expect(scheduler.schedule).not.toHaveBeenCalled()
  })

  it('attaches an encrypted split instruction in split mode', async () => {
    accountRepo.findByUserId.mockResolvedValue(splitAccount)

    const intent = await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))

    expect(gateway.buildCheckoutIntent).toHaveBeenCalledWith(
      expect.objectContaining({ receiverIdentifier: '984112233', transferableCents: 1885 }),
    )
    expect(intent.payload.transferTo).toBe('encrypted')
    expect(intent.payload.token).toBe('platform-token')
  })

  it('records the transferable amount on the transaction in split mode', async () => {
    accountRepo.findByUserId.mockResolvedValue(splitAccount)

    await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))

    expect(transactionRepo.save.mock.calls[0][0].transferToCents).toBe(1885)
    expect(transactionRepo.save.mock.calls[0][0].receiverSnapshot).toBe('984112233')
  })

  it('schedules the fallback confirmation job', async () => {
    await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))

    expect(scheduler.schedule).toHaveBeenCalledWith(expect.stringMatching(/^tt-/))
  })

  it('never leaves the missing order case unhandled', async () => {
    contextRepo.findByOrderIds.mockResolvedValue([])

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER)),
    ).rejects.toThrow(AppException)
  })

  it('refuses an order that belongs to another buyer and discloses no token', async () => {
    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], 'someone-else')),
    ).rejects.toMatchObject({ messageKey: 'payment.order_not_yours' })
  })

  it('creates a new transaction and schedules a sweep for the requested order', async () => {
    const intent = await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))

    expect(contextRepo.findByOrderIds).toHaveBeenCalledWith(['order-1'])
    expect(transactionRepo.save).toHaveBeenCalledTimes(1)
    expect(scheduler.schedule).toHaveBeenCalledWith(intent.payload.clientTransactionId)
  })

  it('disables the seller account when the stored credentials are rejected', async () => {
    cipher.decrypt.mockImplementation(() => {
      throw AppException.businessRule('payment.invalid_credentials')
    })

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.invalid_credentials' })

    expect(merchantAccount.disable).toHaveBeenCalled()
    expect(accountWriteRepo.save).toHaveBeenCalledWith(merchantAccount)
  })

  it('rejects the ownership mismatch before checking status, subtotal, or the account', async () => {
    contextRepo.findByOrderIds.mockResolvedValue([
      { ...CONTEXT, status: 'paid', subtotalDollars: null },
    ])

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], 'someone-else')),
    ).rejects.toMatchObject({ messageKey: 'payment.order_not_yours' })
    expect(accountRepo.findByUserId).not.toHaveBeenCalled()
  })

  it('charges the sum of every order in the group', async () => {
    const { handler, transactionRepo } = buildHandler({
      contexts: [
        {
          orderId: 'order-1',
          status: 'pending',
          subtotalDollars: 10,
          sellerUserId: 'seller-1',
          buyerUserId: BUYER,
        },
        {
          orderId: 'order-2',
          status: 'pending',
          subtotalDollars: 15,
          sellerUserId: 'seller-1',
          buyerUserId: BUYER,
        },
      ],
    })

    await handler.execute(new CreatePaymentIntentCommand(['order-1', 'order-2'], BUYER))

    const saved = transactionRepo.save.mock.calls[0][0]
    expect(saved.amountCents).toBe(2500)
    expect(saved.orderIds).toEqual(['order-1', 'order-2'])
  })

  it('says the event has no payment account, not that the order is missing, when the event has no creator', async () => {
    const { handler } = buildHandler({
      contexts: [
        {
          orderId: 'order-1',
          status: 'draft',
          subtotalDollars: 10,
          sellerUserId: null,
          buyerUserId: BUYER,
        },
      ],
    })

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER)),
    ).rejects.toMatchObject({ messageKey: 'payment.account_not_found' })
  })

  it('refuses a group whose orders belong to different sellers, since one charge cannot reach two accounts', async () => {
    const { handler } = buildHandler({
      contexts: [
        {
          orderId: 'order-1',
          status: 'pending',
          subtotalDollars: 10,
          sellerUserId: 'seller-1',
          buyerUserId: BUYER,
        },
        {
          orderId: 'order-2',
          status: 'pending',
          subtotalDollars: 15,
          sellerUserId: 'seller-2',
          buyerUserId: BUYER,
        },
      ],
    })

    await expect(
      handler.execute(new CreatePaymentIntentCommand(['order-1', 'order-2'], BUYER)),
    ).rejects.toThrow()
  })

  it('accepts a draft order, since a card payment is exactly what a draft is for', async () => {
    const { handler, transactionRepo } = buildHandler({
      contexts: [
        {
          orderId: 'order-1',
          status: 'draft',
          subtotalDollars: 10,
          sellerUserId: 'seller-1',
          buyerUserId: BUYER,
        },
      ],
    })

    await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))

    expect(transactionRepo.save).toHaveBeenCalled()
  })

  it('creates a fresh transaction on every call, so a reload never reuses a spent identifier', async () => {
    const { handler, transactionRepo } = buildHandler({
      contexts: [
        {
          orderId: 'order-1',
          status: 'pending',
          subtotalDollars: 10,
          sellerUserId: 'seller-1',
          buyerUserId: BUYER,
        },
      ],
    })

    await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))
    await handler.execute(new CreatePaymentIntentCommand(['order-1'], BUYER))

    const [first, second] = transactionRepo.save.mock.calls.map((call) => call[0])
    expect(first.clientTransactionId).not.toBe(second.clientTransactionId)
  })
})
