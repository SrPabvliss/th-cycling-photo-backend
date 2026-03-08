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

  const eventId = '550e8400-e29b-41d4-a716-446655440000'

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const existingEvent = Event.fromPersistence({
    id: eventId,
    name: 'Test Event',
    date: futureDate,
    location: 'Ambato',
    provinceId: null,
    cantonId: null,
    status: 'active',
    totalPhotos: 0,
    processedPhotos: 0,
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
    eventReadRepo = {
      findById: jest.fn(),
      getEventsList: jest.fn(),
      getEventDetail: jest.fn(),
    } as jest.Mocked<IEventReadRepository>

    photoWriteRepo = {
      save: jest.fn(),
      saveMany: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IPhotoWriteRepository>

    handler = new ConfirmPhotoBatchHandler(eventReadRepo, photoWriteRepo)
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

  it('should return confirmed: 0 when all photos are duplicates', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoWriteRepo.saveMany.mockResolvedValueOnce(0)

    const command = new ConfirmPhotoBatchCommand(eventId, [validBatchItem])
    const result = await handler.execute(command)

    expect(result).toEqual({ confirmed: 0 })
  })
})
