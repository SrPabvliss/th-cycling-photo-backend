import { Logger } from '@nestjs/common'
import { ConfirmPaymentTransactionCommand } from '@payments/application/commands'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import { ConfirmPaymentProcessor } from './confirm-payment.processor'

const SELLER = 'seller-1'
const BUYER = 'buyer-1'

type FixtureContext = {
  orderId: string
  status: string
  subtotalDollars: number | null
  sellerUserId: string
  buyerUserId: string
}

function buildTransaction(overrides: Record<string, unknown> = {}) {
  return {
    orderIds: ['order-1'],
    isSettled: true,
    status: PaymentTransactionStatus.APPROVED,
    gatewayTransactionId: '12345',
    markExpired: jest.fn(),
    ...overrides,
  }
}

function buildProcessor({
  transaction = buildTransaction(),
  contexts = [],
}: {
  transaction?: ReturnType<typeof buildTransaction>
  contexts?: FixtureContext[]
} = {}) {
  const readRepo = {
    findByClientTransactionId: jest.fn().mockResolvedValue(transaction),
  }
  const writeRepo = {
    runLocked: jest.fn().mockImplementation((_id, work) => work(transaction)),
  }
  const contextRepo = {
    findByOrderIds: jest.fn().mockResolvedValue(contexts),
  }
  const commandBus = { execute: jest.fn() }
  const processor = new ConfirmPaymentProcessor(
    readRepo as never,
    writeRepo as never,
    contextRepo as never,
    commandBus as never,
  )

  return { processor, readRepo, writeRepo, contextRepo, commandBus }
}

describe('ConfirmPaymentProcessor', () => {
  it('does nothing when the transaction already settled', async () => {
    const { processor, writeRepo, commandBus } = buildProcessor({
      transaction: buildTransaction({ isSettled: true, status: PaymentTransactionStatus.DECLINED }),
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(writeRepo.runLocked).not.toHaveBeenCalled()
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('expires an abandoned transaction and logs at error level that the vendor will have reversed it', async () => {
    const transaction = {
      isSettled: false,
      orderIds: ['order-1', 'order-2'],
      markExpired: jest.fn(),
    }
    const { processor, writeRepo } = buildProcessor({ transaction: transaction as never })
    writeRepo.runLocked.mockImplementation((_id, work) => work(transaction))
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(transaction.markExpired).toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('never confirmed and the vendor will have reversed it'),
    )
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('clientTransactionId=tx-1 orderIds=order-1,order-2'),
    )

    errorSpy.mockRestore()
  })

  it('leaves a transaction that settled between the read and the lock', async () => {
    const transaction = { isSettled: true, markExpired: jest.fn() }
    const { processor, writeRepo } = buildProcessor({
      transaction: { isSettled: false } as never,
    })
    writeRepo.runLocked.mockImplementation((_id, work) => work(transaction))

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(transaction.markExpired).not.toHaveBeenCalled()
  })

  it('ignores a transaction that no longer exists', async () => {
    const { processor, readRepo, writeRepo } = buildProcessor()
    readRepo.findByClientTransactionId.mockResolvedValue(null)

    await expect(
      processor.process({ data: { clientTransactionId: 'tx-1' } } as never),
    ).resolves.toBeUndefined()
    expect(writeRepo.runLocked).not.toHaveBeenCalled()
  })

  it('dispatches the confirm command for a settled and approved transaction, proving the background self-heal is authorised via the order context', async () => {
    const { processor, contextRepo, commandBus } = buildProcessor({
      transaction: buildTransaction({ orderIds: ['order-1'] }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'pending',
          subtotalDollars: 10,
          sellerUserId: SELLER,
          buyerUserId: BUYER,
        },
      ],
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(contextRepo.findByOrderIds).toHaveBeenCalledWith(['order-1'])
    expect(commandBus.execute).toHaveBeenCalledWith(
      new ConfirmPaymentTransactionCommand('tx-1', '12345', BUYER),
    )
  })

  it('does not dispatch the confirm command when the order already settled, so a completed sale raises no alarm', async () => {
    const { processor, commandBus } = buildProcessor({
      transaction: buildTransaction({ orderIds: ['order-1'] }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'paid',
          subtotalDollars: 10,
          sellerUserId: SELLER,
          buyerUserId: BUYER,
        },
      ],
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('does not dispatch the confirm command for a delivered order either', async () => {
    const { processor, commandBus } = buildProcessor({
      transaction: buildTransaction({ orderIds: ['order-1'] }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'delivered',
          subtotalDollars: 10,
          sellerUserId: SELLER,
          buyerUserId: BUYER,
        },
      ],
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('dispatches the confirm command when the order is still waiting for payment info', async () => {
    const { processor, commandBus } = buildProcessor({
      transaction: buildTransaction({ orderIds: ['order-1'] }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'payment_info_sent',
          subtotalDollars: 10,
          sellerUserId: SELLER,
          buyerUserId: BUYER,
        },
      ],
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).toHaveBeenCalledWith(
      new ConfirmPaymentTransactionCommand('tx-1', '12345', BUYER),
    )
  })

  it('dispatches the confirm command for a draft order, since a card payment is exactly what a draft is for', async () => {
    const { processor, commandBus } = buildProcessor({
      transaction: buildTransaction({ orderIds: ['order-1'] }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'draft',
          subtotalDollars: 10,
          sellerUserId: SELLER,
          buyerUserId: BUYER,
        },
      ],
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).toHaveBeenCalledWith(
      new ConfirmPaymentTransactionCommand('tx-1', '12345', BUYER),
    )
  })

  it('does not dispatch the confirm command for a settled and declined transaction', async () => {
    const { processor, commandBus } = buildProcessor({
      transaction: buildTransaction({ status: PaymentTransactionStatus.DECLINED }),
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('logs a warning and does not dispatch when the approved transaction has no gateway id', async () => {
    const { processor, contextRepo, commandBus } = buildProcessor({
      transaction: buildTransaction({ gatewayTransactionId: null }),
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(contextRepo.findByOrderIds).not.toHaveBeenCalled()
  })

  it('does not dispatch when no order context can be found', async () => {
    const { processor, commandBus } = buildProcessor({
      transaction: buildTransaction({ orderIds: ['order-1'] }),
      contexts: [],
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('redispatches confirmation when any covered order is still unsettled', async () => {
    const { processor, commandBus } = buildProcessor({
      transaction: buildTransaction({
        orderIds: ['order-1', 'order-2'],
        status: PaymentTransactionStatus.APPROVED,
        gatewayTransactionId: '900',
      }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'paid',
          subtotalDollars: 10,
          sellerUserId: SELLER,
          buyerUserId: BUYER,
        },
        {
          orderId: 'order-2',
          status: 'pending',
          subtotalDollars: 15,
          sellerUserId: SELLER,
          buyerUserId: BUYER,
        },
      ],
    })

    await processor.process({ data: { clientTransactionId: 'tt-multi' } } as never)

    expect(commandBus.execute).toHaveBeenCalledTimes(1)
  })

  it('does nothing when every covered order is already settled', async () => {
    const { processor, commandBus } = buildProcessor({
      transaction: buildTransaction({
        orderIds: ['order-1'],
        status: PaymentTransactionStatus.APPROVED,
        gatewayTransactionId: '900',
      }),
      contexts: [
        {
          orderId: 'order-1',
          status: 'paid',
          subtotalDollars: 10,
          sellerUserId: SELLER,
          buyerUserId: BUYER,
        },
      ],
    })

    await processor.process({ data: { clientTransactionId: 'tt-multi' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
  })
})
