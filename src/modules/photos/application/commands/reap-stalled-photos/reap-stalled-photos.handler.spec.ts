import type { IPhotoClassificationQueue, IPhotoWriteRepository } from '@photos/domain/ports'
import { ReapStalledPhotosCommand } from './reap-stalled-photos.command'
import { ReapStalledPhotosHandler } from './reap-stalled-photos.handler'

describe('ReapStalledPhotosHandler', () => {
  const now = new Date('2026-11-01T22:00:00.000Z')
  let photoWriteRepo: jest.Mocked<Pick<IPhotoWriteRepository, 'markStalledAsFailed'>>
  let classificationQueue: jest.Mocked<IPhotoClassificationQueue>
  let handler: ReapStalledPhotosHandler

  beforeEach(() => {
    photoWriteRepo = { markStalledAsFailed: jest.fn().mockResolvedValue([]) }
    classificationQueue = {
      enqueue: jest.fn(),
      getLivePhotoIds: jest.fn().mockResolvedValue(new Set(['live-1'])),
    }
    handler = new ReapStalledPhotosHandler(
      photoWriteRepo as unknown as IPhotoWriteRepository,
      classificationQueue,
    )
  })

  it('reaps with a 15-minute threshold and excludes live jobs', async () => {
    photoWriteRepo.markStalledAsFailed.mockResolvedValue(['p-1', 'p-2'])

    const reaped = await handler.execute(new ReapStalledPhotosCommand(now))

    expect(photoWriteRepo.markStalledAsFailed).toHaveBeenCalledWith(
      new Date('2026-11-01T21:45:00.000Z'),
      ['live-1'],
    )
    expect(reaped).toEqual(['p-1', 'p-2'])
  })

  it('returns nothing when nothing was reaped', async () => {
    await expect(handler.execute(new ReapStalledPhotosCommand(now))).resolves.toEqual([])
  })
})
