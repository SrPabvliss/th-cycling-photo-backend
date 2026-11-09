import type { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetClassificationFailuresHandler } from './get-classification-failures.handler'
import { GetClassificationFailuresQuery } from './get-classification-failures.query'

describe('GetClassificationFailuresHandler', () => {
  const eventId = '550e8400-e29b-41d4-a716-446655440000'
  const eventReadRepo = { findById: jest.fn() }
  const photoReadRepo = { countFailedByEvent: jest.fn() }
  const authz = { resolveEventScope: jest.fn(), assert: jest.fn(), can: jest.fn() }
  const handler = new GetClassificationFailuresHandler(
    eventReadRepo as unknown as IEventReadRepository,
    photoReadRepo as unknown as IPhotoReadRepository,
    authz as unknown as IAuthorizationService,
  )

  beforeEach(() => {
    jest.clearAllMocks()
    eventReadRepo.findById.mockResolvedValue({ id: eventId } as Event)
    authz.resolveEventScope.mockResolvedValue(EventScope.unrestricted())
    authz.assert.mockResolvedValue(undefined)
    photoReadRepo.countFailedByEvent.mockResolvedValue(7)
  })

  it('counts failed photos of the event', async () => {
    const result = await handler.execute(new GetClassificationFailuresQuery(eventId, 'user-1'))

    expect(authz.assert).toHaveBeenCalledWith('user-1', 'photo.classification.retry', eventId)
    expect(photoReadRepo.countFailedByEvent).toHaveBeenCalledWith(eventId)
    expect(result).toEqual({ failedCount: 7 })
  })

  it('rejects an event outside the user scope', async () => {
    eventReadRepo.findById.mockResolvedValue(null)

    await expect(
      handler.execute(new GetClassificationFailuresQuery(eventId, 'user-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(photoReadRepo.countFailedByEvent).not.toHaveBeenCalled()
  })
})
