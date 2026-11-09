import type { FreezeStateService } from '@events/application/services/freeze-state.service'
import type { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import type { IPhotoClassificationQueue, IPhotoReadRepository } from '@photos/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { ReclassifyPhotosCommand } from './reclassify-photos.command'
import { ReclassifyPhotosHandler } from './reclassify-photos.handler'

describe('ReclassifyPhotosHandler', () => {
  const eventId = '550e8400-e29b-41d4-a716-446655440000'
  const userId = 'user-1'
  let eventReadRepo: { findById: jest.Mock }
  let photoReadRepo: { getFailedPhotoIds: jest.Mock }
  let classificationQueue: jest.Mocked<IPhotoClassificationQueue>
  let authz: { resolveEventScope: jest.Mock; assert: jest.Mock; can: jest.Mock }
  let freeze: { assertNotFrozen: jest.Mock }
  let handler: ReclassifyPhotosHandler

  beforeEach(() => {
    eventReadRepo = { findById: jest.fn().mockResolvedValue({ id: eventId } as Event) }
    photoReadRepo = { getFailedPhotoIds: jest.fn().mockResolvedValue(['a', 'b']) }
    classificationQueue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      getLivePhotoIds: jest.fn().mockResolvedValue(new Set<string>()),
    }
    authz = {
      resolveEventScope: jest.fn().mockResolvedValue(EventScope.unrestricted()),
      assert: jest.fn().mockResolvedValue(undefined),
      can: jest.fn(),
    }
    freeze = { assertNotFrozen: jest.fn().mockResolvedValue(undefined) }
    handler = new ReclassifyPhotosHandler(
      eventReadRepo as unknown as IEventReadRepository,
      photoReadRepo as unknown as IPhotoReadRepository,
      classificationQueue,
      authz as unknown as IAuthorizationService,
      freeze as unknown as FreezeStateService,
    )
  })

  it('reclassifies every failed photo of the event', async () => {
    const result = await handler.execute(new ReclassifyPhotosCommand(eventId, null, userId))

    expect(authz.assert).toHaveBeenCalledWith(userId, 'photo.classification.retry', eventId)
    expect(photoReadRepo.getFailedPhotoIds).toHaveBeenCalledWith(eventId, null)
    expect(classificationQueue.enqueue).toHaveBeenCalledWith(['a', 'b'])
    expect(result).toEqual({ enqueued: 2, ignored: 0 })
  })

  it('ignores ids outside the event or not failed', async () => {
    photoReadRepo.getFailedPhotoIds.mockResolvedValue(['a'])

    const result = await handler.execute(
      new ReclassifyPhotosCommand(eventId, ['a', 'x', 'y'], userId),
    )

    expect(photoReadRepo.getFailedPhotoIds).toHaveBeenCalledWith(eventId, ['a', 'x', 'y'])
    expect(classificationQueue.enqueue).toHaveBeenCalledWith(['a'])
    expect(result).toEqual({ enqueued: 1, ignored: 2 })
  })

  it('skips photos with live jobs', async () => {
    classificationQueue.getLivePhotoIds.mockResolvedValue(new Set(['b']))

    const result = await handler.execute(new ReclassifyPhotosCommand(eventId, null, userId))

    expect(classificationQueue.enqueue).toHaveBeenCalledWith(['a'])
    expect(result).toEqual({ enqueued: 1, ignored: 1 })
  })

  it('rejects an event outside the user scope', async () => {
    eventReadRepo.findById.mockResolvedValue(null)

    await expect(
      handler.execute(new ReclassifyPhotosCommand(eventId, null, userId)),
    ).rejects.toBeInstanceOf(AppException)
    expect(classificationQueue.enqueue).not.toHaveBeenCalled()
  })

  it('rejects a user without permission on the event', async () => {
    authz.assert.mockRejectedValue(AppException.forbidden('photo.classification.retry'))

    await expect(
      handler.execute(new ReclassifyPhotosCommand(eventId, null, userId)),
    ).rejects.toBeInstanceOf(AppException)
    expect(classificationQueue.enqueue).not.toHaveBeenCalled()
  })

  it('rejects a frozen event', async () => {
    freeze.assertNotFrozen.mockRejectedValue(AppException.businessRule('event.frozen_not_editable'))

    await expect(
      handler.execute(new ReclassifyPhotosCommand(eventId, null, userId)),
    ).rejects.toBeInstanceOf(AppException)
    expect(classificationQueue.enqueue).not.toHaveBeenCalled()
  })
})
