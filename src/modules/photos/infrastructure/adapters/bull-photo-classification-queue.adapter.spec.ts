import type { Queue } from 'bullmq'
import { BullPhotoClassificationQueue } from './bull-photo-classification-queue.adapter'

describe('BullPhotoClassificationQueue', () => {
  const queue = { addBulk: jest.fn(), getJobs: jest.fn() }
  const adapter = new BullPhotoClassificationQueue(queue as unknown as Queue)

  beforeEach(() => jest.clearAllMocks())

  it('getLivePhotoIds collects photoId from live jobs', async () => {
    queue.getJobs.mockResolvedValue([
      { data: { photoId: 'p-1' } },
      { data: { photoId: 'p-2' } },
      undefined,
    ])

    const live = await adapter.getLivePhotoIds()

    expect(queue.getJobs).toHaveBeenCalledWith(['active', 'waiting', 'delayed', 'prioritized'])
    expect([...live].sort()).toEqual(['p-1', 'p-2'])
  })

  it('enqueue adds classify-photo jobs like confirm-batch', async () => {
    await adapter.enqueue(['p-1'])

    expect(queue.addBulk).toHaveBeenCalledWith([
      {
        name: 'classify-photo',
        data: { photoId: 'p-1' },
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      },
    ])
  })

  it('enqueue with no ids does nothing', async () => {
    await adapter.enqueue([])
    expect(queue.addBulk).not.toHaveBeenCalled()
  })
})
