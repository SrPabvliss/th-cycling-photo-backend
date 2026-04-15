import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import type { IPhotoWriteRepository } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import type { PhotoBatchItem } from './confirm-photo-batch.command'
import { ConfirmPhotoBatchCommand } from './confirm-photo-batch.command'
import { ConfirmPhotoBatchHandler } from './confirm-photo-batch.handler'

describe('ConfirmPhotoBatchHandler', () => {
  let handler: ConfirmPhotoBatchHandler
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let photoWriteRepo: jest.Mocked<IPhotoWriteRepository>
  let kvStorage: { writeBulk: jest.Mock }
  let embeddingQueue: { add: jest.Mock; addBulk: jest.Mock }

  const eventId = '550e8400-e29b-41d4-a716-446655440000'

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const existingEvent = Event.fromPersistence({
    slug: 'test-event',
    id: eventId,
    name: 'Test Event',
    description: null,
    date: futureDate,

    provinceId: null,
    cantonId: null,
    eventTypeId: 1,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  })

  const validBatchItem: PhotoBatchItem = {
    fileName: 'IMG_001.jpg',
    fileSize: 5242880,
    objectKey: `events/${eventId}/abc-123-IMG_001.jpg`,
    contentType: 'image/jpeg',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    eventReadRepo = {
      findById: jest.fn(),
      getEventsList: jest.fn(),
      getEventDetail: jest.fn(),
      countAll: jest.fn(),
      getPublicEventsList: jest.fn(),
      getPublicEventDetail: jest.fn(),
      getPublicPhotos: jest.fn(),
      existsActiveEvent: jest.fn(),
      existsActiveEventBySlug: jest.fn(),
    } as jest.Mocked<IEventReadRepository>

    photoWriteRepo = {
      save: jest.fn(),
      saveMany: jest.fn(),
      delete: jest.fn(),
      markAsClassified: jest.fn(),
      bulkUpdateCategory: jest.fn(),
    } as jest.Mocked<IPhotoWriteRepository>

    kvStorage = { writeBulk: jest.fn().mockResolvedValue(undefined) }
    embeddingQueue = { add: jest.fn(), addBulk: jest.fn() }

    handler = new ConfirmPhotoBatchHandler(
      eventReadRepo,
      photoWriteRepo,
      kvStorage as any,
      embeddingQueue as unknown as import('bullmq').Queue,
    )
  })

  it('should throw NOT_FOUND when event does not exist', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(null)

    const command = new ConfirmPhotoBatchCommand(eventId, [validBatchItem])
    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('should throw BUSINESS_RULE when objectKey has wrong prefix', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)

    const wrongItem: PhotoBatchItem = {
      ...validBatchItem,
      objectKey: 'events/other-event-id/abc-123-IMG_001.jpg',
    }

    const command = new ConfirmPhotoBatchCommand(eventId, [wrongItem])
    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('BUSINESS_RULE')
  })

  it('should call saveMany with Photo entities and return confirmed count', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoWriteRepo.saveMany.mockResolvedValueOnce(2)

    const command = new ConfirmPhotoBatchCommand(eventId, [
      validBatchItem,
      {
        ...validBatchItem,
        objectKey: `events/${eventId}/def-456-IMG_002.jpg`,
        fileName: 'IMG_002.jpg',
      },
    ])

    const result = await handler.execute(command)

    expect(photoWriteRepo.saveMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ eventId, filename: 'IMG_001.jpg' }),
        expect.objectContaining({ eventId, filename: 'IMG_002.jpg' }),
      ]),
    )
    expect(result).toEqual({ confirmed: 2 })
  })

  it('should enqueue embedding generation for each confirmed photo', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoWriteRepo.saveMany.mockResolvedValueOnce(2)

    const command = new ConfirmPhotoBatchCommand(eventId, [
      validBatchItem,
      {
        ...validBatchItem,
        objectKey: `events/${eventId}/def-456-IMG_002.jpg`,
        fileName: 'IMG_002.jpg',
      },
    ])

    await handler.execute(command)

    expect(embeddingQueue.addBulk).toHaveBeenCalledTimes(1)
    expect(embeddingQueue.addBulk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'generate-embedding',
          data: expect.objectContaining({ photoId: expect.any(String) }),
          opts: expect.objectContaining({ attempts: 3 }),
        }),
      ]),
    )
  })

  it('should return confirmed: 0 when all photos are duplicates', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoWriteRepo.saveMany.mockResolvedValueOnce(0)

    const command = new ConfirmPhotoBatchCommand(eventId, [validBatchItem])
    const result = await handler.execute(command)

    expect(result).toEqual({ confirmed: 0 })
  })
})
