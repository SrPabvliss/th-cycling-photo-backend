import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import type { IPhotoWriteRepository } from '@photos/domain/ports'
import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
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
  let classificationQueue: { add: jest.Mock; addBulk: jest.Mock }
  let authz: jest.Mocked<IAuthorizationService>
  let prisma: { $transaction: jest.Mock; event: { findUniqueOrThrow: jest.Mock } }

  const eventId = '550e8400-e29b-41d4-a716-446655440000'
  const audit = new AuditContext('u1')
  const unrestrictedScope = EventScope.unrestricted()

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const existingEvent = Event.fromPersistence({
    slug: 'test-event',
    id: eventId,
    tenantId: '11111111-1111-4111-8111-111111111111',
    name: 'Test Event',
    startDate: futureDate,
    endDate: futureDate,

    provinceId: null,
    cantonId: null,
    eventTypeId: 1,
    status: 'active',
    snapPublicName: null,
    snapWatermarkStorageKey: null,
    snapWhatsappNumber: null,
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
      findByIdInScope: jest.fn(),
      getEventsList: jest.fn(),
      getEventDetail: jest.fn(),
      getEventDetailBySlug: jest.fn(),
      countAll: jest.fn(),
      getPublicEventsList: jest.fn(),
      getPublicEventDetail: jest.fn(),
      getPublicPhotos: jest.fn(),
      existsActiveEvent: jest.fn(),
      existsActiveEventBySlug: jest.fn(),
      getAssignedEventsByStatus: jest.fn(),
      countAssignedEventsByStatus: jest.fn(),
      getAssignedEventIdsByStatus: jest.fn(),
      getAllAssignedEventIds: jest.fn().mockResolvedValue([]),
      getEventBriefsByIds: jest.fn(),
      isFrozen: jest.fn(),
    } as jest.Mocked<IEventReadRepository>

    photoWriteRepo = {
      save: jest.fn(),
      saveMany: jest.fn(),
      claimPhotoQuota: jest.fn().mockResolvedValue(true),
      delete: jest.fn(),
      bulkUpdateCategory: jest.fn(),
      setRequiresRetouch: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<IPhotoWriteRepository>

    kvStorage = { writeBulk: jest.fn().mockResolvedValue(undefined) }
    embeddingQueue = { add: jest.fn(), addBulk: jest.fn() }
    classificationQueue = { add: jest.fn(), addBulk: jest.fn() }

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as jest.Mocked<IAuthorizationService>

    prisma = {
      $transaction: jest.fn((fn) => fn(prisma)),
      event: { findUniqueOrThrow: jest.fn() },
    }

    handler = new ConfirmPhotoBatchHandler(
      eventReadRepo,
      photoWriteRepo,
      kvStorage as any,
      embeddingQueue as unknown as import('bullmq').Queue,
      classificationQueue as unknown as import('bullmq').Queue,
      authz,
      prisma as any,
    )
  })

  it('should throw NOT_FOUND when event does not exist', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(null)

    const command = new ConfirmPhotoBatchCommand(eventId, [validBatchItem], audit)
    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('should throw INTERNAL when the command carries no audit context', async () => {
    const command = new ConfirmPhotoBatchCommand(eventId, [validBatchItem])
    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(eventReadRepo.findById).not.toHaveBeenCalled()
  })

  it('should throw NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    authz.resolveEventScope.mockResolvedValueOnce(new EventScope(false, ['some-other-tenant'], []))

    const command = new ConfirmPhotoBatchCommand(eventId, [validBatchItem], audit)
    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
    expect(photoWriteRepo.saveMany).not.toHaveBeenCalled()
  })

  it('rejects when the caller lacks photo.upload for this event', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    const command = new ConfirmPhotoBatchCommand(eventId, [validBatchItem], audit)

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(photoWriteRepo.saveMany).not.toHaveBeenCalled()
  })

  it('should throw BUSINESS_RULE when objectKey has wrong prefix', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)

    const wrongItem: PhotoBatchItem = {
      ...validBatchItem,
      objectKey: 'events/other-event-id/abc-123-IMG_001.jpg',
    }

    const command = new ConfirmPhotoBatchCommand(eventId, [wrongItem], audit)
    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('BUSINESS_RULE')
  })

  it('should call saveMany with Photo entities and return confirmed count', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoWriteRepo.saveMany.mockResolvedValueOnce(2)

    const command = new ConfirmPhotoBatchCommand(
      eventId,
      [
        validBatchItem,
        {
          ...validBatchItem,
          objectKey: `events/${eventId}/def-456-IMG_002.jpg`,
          fileName: 'IMG_002.jpg',
        },
      ],
      audit,
    )

    const result = await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith('u1', 'photo.upload', eventId)
    expect(photoWriteRepo.saveMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ eventId, filename: 'IMG_001.jpg' }),
        expect.objectContaining({ eventId, filename: 'IMG_002.jpg' }),
      ]),
      prisma,
    )
    expect(result).toEqual({ confirmed: 2 })
  })

  it('should enqueue embedding generation for each confirmed photo', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoWriteRepo.saveMany.mockResolvedValueOnce(2)

    const command = new ConfirmPhotoBatchCommand(
      eventId,
      [
        validBatchItem,
        {
          ...validBatchItem,
          objectKey: `events/${eventId}/def-456-IMG_002.jpg`,
          fileName: 'IMG_002.jpg',
        },
      ],
      audit,
    )

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

    const command = new ConfirmPhotoBatchCommand(eventId, [validBatchItem], audit)
    const result = await handler.execute(command)

    expect(result).toEqual({ confirmed: 0 })
  })

  it('rejects the whole batch when the event photo quota would be exceeded', async () => {
    eventReadRepo.findById.mockResolvedValueOnce(existingEvent)
    photoWriteRepo.saveMany.mockResolvedValue(2)
    photoWriteRepo.claimPhotoQuota.mockResolvedValue(false)
    prisma.event.findUniqueOrThrow.mockResolvedValue({ photo_quota: 10, photos_uploaded: 9 })

    const command = new ConfirmPhotoBatchCommand(eventId, [validBatchItem], audit)

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'event.photo_quota_exceeded',
    })
  })
})
