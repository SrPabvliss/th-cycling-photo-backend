import type { Queue } from 'bullmq'
import type { IRikuchiyClient } from '../../domain/ports'
import { RikuchiyDeliverySchedulerService } from './rikuchiy-delivery-scheduler.service'

describe('RikuchiyDeliverySchedulerService', () => {
  const queue = {
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    removeJobScheduler: jest.fn().mockResolvedValue(true),
  }
  const client = { isConfigured: jest.fn() }

  const scheduler = () =>
    new RikuchiyDeliverySchedulerService(
      queue as unknown as Queue,
      client as unknown as IRikuchiyClient,
    )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('schedules the delivery every 30 seconds when rikuchiy is configured', async () => {
    client.isConfigured.mockReturnValue(true)

    await scheduler().onModuleInit()

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'rikuchiy-delivery',
      { every: 30_000 },
      expect.objectContaining({ name: 'deliver' }),
    )
    expect(queue.removeJobScheduler).not.toHaveBeenCalled()
  })

  it('removes a delivery left scheduled earlier when rikuchiy is not configured', async () => {
    client.isConfigured.mockReturnValue(false)

    await scheduler().onModuleInit()

    expect(queue.removeJobScheduler).toHaveBeenCalledWith('rikuchiy-delivery')
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled()
  })
})
