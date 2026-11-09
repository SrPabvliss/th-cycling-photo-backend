import { PaymentConfirmationScheduler } from './payment-confirmation-scheduler.service'

describe('PaymentConfirmationScheduler', () => {
  let queue: { add: jest.Mock }

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue(undefined) }
  })

  function buildScheduler(configured?: number): PaymentConfirmationScheduler {
    const config = {
      get: jest
        .fn()
        .mockImplementation((key: string, fallback: number) =>
          key === 'payments.expirySweepDelayMs' ? (configured ?? fallback) : fallback,
        ),
    }
    return new PaymentConfirmationScheduler(queue as never, config as never)
  }

  it('delays the sweep by the configured expiry window', async () => {
    await buildScheduler(600_000).schedule('tx-1')

    expect(queue.add).toHaveBeenCalledWith(
      'confirm',
      { clientTransactionId: 'tx-1' },
      expect.objectContaining({ delay: 600_000 }),
    )
  })

  it('falls back to fifteen minutes, past both vendor windows, when nothing is configured', async () => {
    await buildScheduler().schedule('tx-1')

    expect(queue.add).toHaveBeenCalledWith(
      'confirm',
      { clientTransactionId: 'tx-1' },
      expect.objectContaining({ delay: 900_000 }),
    )
  })

  it('retries three times with exponential backoff', async () => {
    await buildScheduler().schedule('tx-1')

    expect(queue.add).toHaveBeenCalledWith(
      'confirm',
      { clientTransactionId: 'tx-1' },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      }),
    )
  })
})
