import { Logger } from '@nestjs/common'
import { ConfirmPaymentTransactionCommand } from '@payments/application/commands'
import { PaymentTransactionStatus } from '@payments/domain/value-objects/payment-transaction-status.vo'
import { ConfirmPaymentProcessor } from './confirm-payment.processor'

describe('ConfirmPaymentProcessor', () => {
  let readRepo: { findByClientTransactionId: jest.Mock }
  let writeRepo: { runLocked: jest.Mock }
  let contextRepo: { findByOrderId: jest.Mock }
  let commandBus: { execute: jest.Mock }
  let processor: ConfirmPaymentProcessor

  beforeEach(() => {
    readRepo = { findByClientTransactionId: jest.fn() }
    writeRepo = {
      runLocked: jest.fn().mockImplementation((_id, work) =>
        work({
          isSettled: false,
          markExpired: jest.fn(),
          status: PaymentTransactionStatus.INITIATED,
        }),
      ),
    }
    contextRepo = {
      findByOrderId: jest.fn().mockResolvedValue({ buyerUserId: 'buyer-1', status: 'pending' }),
    }
    commandBus = { execute: jest.fn() }
    processor = new ConfirmPaymentProcessor(
      readRepo as never,
      writeRepo as never,
      contextRepo as never,
      commandBus as never,
    )
  })

  it('does nothing when the transaction already settled', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue({
      isSettled: true,
      status: PaymentTransactionStatus.DECLINED,
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(writeRepo.runLocked).not.toHaveBeenCalled()
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('expires an abandoned transaction and logs at error level that the vendor will have reversed it', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue({ isSettled: false })
    const transaction = { isSettled: false, orderId: 'order-1', markExpired: jest.fn() }
    writeRepo.runLocked.mockImplementation((_id, work) => work(transaction))
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(transaction.markExpired).toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('never confirmed and the vendor will have reversed it'),
    )
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('clientTransactionId=tx-1 orderId=order-1'),
    )

    errorSpy.mockRestore()
  })

  it('leaves a transaction that settled between the read and the lock', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue({ isSettled: false })
    const transaction = { isSettled: true, markExpired: jest.fn() }
    writeRepo.runLocked.mockImplementation((_id, work) => work(transaction))

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(transaction.markExpired).not.toHaveBeenCalled()
  })

  it('ignores a transaction that no longer exists', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue(null)

    await expect(
      processor.process({ data: { clientTransactionId: 'tx-1' } } as never),
    ).resolves.toBeUndefined()
    expect(writeRepo.runLocked).not.toHaveBeenCalled()
  })

  it('dispatches the confirm command for a settled and approved transaction, proving the background self-heal is authorised via the order context', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
      gatewayTransactionId: '12345',
      orderId: 'order-1',
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(contextRepo.findByOrderId).toHaveBeenCalledWith('order-1')
    expect(commandBus.execute).toHaveBeenCalledWith(
      new ConfirmPaymentTransactionCommand('tx-1', '12345', 'buyer-1'),
    )
  })

  it('does not dispatch the confirm command when the order already settled, so a completed sale raises no alarm', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
      gatewayTransactionId: '12345',
      orderId: 'order-1',
    })
    contextRepo.findByOrderId.mockResolvedValue({ buyerUserId: 'buyer-1', status: 'paid' })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('does not dispatch the confirm command for a delivered order either', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
      gatewayTransactionId: '12345',
      orderId: 'order-1',
    })
    contextRepo.findByOrderId.mockResolvedValue({ buyerUserId: 'buyer-1', status: 'delivered' })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('dispatches the confirm command when the order is still waiting for payment info', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
      gatewayTransactionId: '12345',
      orderId: 'order-1',
    })
    contextRepo.findByOrderId.mockResolvedValue({
      buyerUserId: 'buyer-1',
      status: 'payment_info_sent',
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).toHaveBeenCalledWith(
      new ConfirmPaymentTransactionCommand('tx-1', '12345', 'buyer-1'),
    )
  })

  it('does not dispatch the confirm command for a settled and declined transaction', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue({
      isSettled: true,
      status: PaymentTransactionStatus.DECLINED,
      gatewayTransactionId: '12345',
      orderId: 'order-1',
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('logs a warning and does not dispatch when the approved transaction has no gateway id', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
      gatewayTransactionId: null,
      orderId: 'order-1',
    })

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
    expect(contextRepo.findByOrderId).not.toHaveBeenCalled()
  })

  it('does not dispatch when the order context can no longer be found', async () => {
    readRepo.findByClientTransactionId.mockResolvedValue({
      isSettled: true,
      status: PaymentTransactionStatus.APPROVED,
      gatewayTransactionId: '12345',
      orderId: 'order-1',
    })
    contextRepo.findByOrderId.mockResolvedValue(null)

    await processor.process({ data: { clientTransactionId: 'tx-1' } } as never)

    expect(commandBus.execute).not.toHaveBeenCalled()
  })
})
