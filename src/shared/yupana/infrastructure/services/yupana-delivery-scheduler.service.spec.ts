import type { Queue } from 'bullmq'
import type { IYupanaClient } from '../../domain/ports'
import { YupanaDeliverySchedulerService } from './yupana-delivery-scheduler.service'

describe('YupanaDeliverySchedulerService', () => {
  const queue = {
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    removeJobScheduler: jest.fn().mockResolvedValue(true),
  }
  const client = { isConfigured: jest.fn() }

  const scheduler = () =>
    new YupanaDeliverySchedulerService(
      queue as unknown as Queue,
      client as unknown as IYupanaClient,
    )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('schedules the delivery every 30 seconds when yupana is configured', async () => {
    client.isConfigured.mockReturnValue(true)

    await scheduler().onModuleInit()

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'yupana-delivery',
      { every: 30_000 },
      expect.objectContaining({ name: 'deliver' }),
    )
    expect(queue.removeJobScheduler).not.toHaveBeenCalled()
  })

  it('removes a delivery left scheduled by an earlier start when yupana is not configured', async () => {
    client.isConfigured.mockReturnValue(false)

    await scheduler().onModuleInit()

    expect(queue.removeJobScheduler).toHaveBeenCalledWith('yupana-delivery')
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled()
  })
})
