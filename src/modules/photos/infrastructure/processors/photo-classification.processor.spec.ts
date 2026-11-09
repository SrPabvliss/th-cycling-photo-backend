import { CommandBus } from '@nestjs/cqrs'
import { Test } from '@nestjs/testing'
import { PhotoClassificationProcessor } from './photo-classification.processor'

describe('PhotoClassificationProcessor', () => {
  let processor: PhotoClassificationProcessor
  const commandBus = { execute: jest.fn() }

  beforeEach(async () => {
    jest.clearAllMocks()
    const m = await Test.createTestingModule({
      providers: [PhotoClassificationProcessor, { provide: CommandBus, useValue: commandBus }],
    }).compile()
    processor = m.get(PhotoClassificationProcessor)
  })

  it('dispatches ProcessPhotoClassificationCommand on job', async () => {
    commandBus.execute.mockResolvedValue(undefined)
    await processor.process({ data: { photoId: 'p-1' }, attemptsMade: 0 } as any)
    expect(commandBus.execute).toHaveBeenCalledTimes(1)
  })

  it('passes isFinalAttempt true on the last attempt and false before', async () => {
    commandBus.execute.mockResolvedValue(undefined)
    await processor.process({
      data: { photoId: 'p-1' },
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as any)
    await processor.process({
      data: { photoId: 'p-1' },
      attemptsMade: 2,
      opts: { attempts: 3 },
    } as any)
    expect(commandBus.execute.mock.calls[0][0]).toMatchObject({
      photoId: 'p-1',
      isFinalAttempt: false,
    })
    expect(commandBus.execute.mock.calls[1][0]).toMatchObject({
      photoId: 'p-1',
      isFinalAttempt: true,
    })
  })

  it('rethrows when command fails (BullMQ retry)', async () => {
    commandBus.execute.mockRejectedValue(new Error('network'))
    await expect(
      processor.process({ data: { photoId: 'p-1' }, attemptsMade: 0 } as any),
    ).rejects.toThrow('network')
  })
})
