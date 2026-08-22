import { Event } from '@events/domain/entities'
import { IEventReadRepository, IEventWriteRepository } from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { DeleteEventCommand } from './delete-event.command'
import { DeleteEventHandler } from './delete-event.handler'

describe('DeleteEventHandler', () => {
  let handler: DeleteEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let readRepo: jest.Mocked<IEventReadRepository>
  let authz: jest.Mocked<IAuthorizationService>
  const unrestrictedScope = EventScope.unrestricted()

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  function existingEventFixture() {
    return Event.fromPersistence({
      slug: 'test-event',
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'Vuelta Ciclística',
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
  }

  beforeEach(() => {
    writeRepo = {
      save: jest.fn(),
      updatePhotoQuota: jest.fn(),
    } as jest.Mocked<IEventWriteRepository>

    readRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn(),
      getEventsList: jest.fn(),
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
      getAllAssignedEventIds: jest.fn(),
      getEventBriefsByIds: jest.fn(),
      isFrozen: jest.fn(),
    } as jest.Mocked<IEventReadRepository>

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as jest.Mocked<IAuthorizationService>

    handler = new DeleteEventHandler(writeRepo, readRepo, authz)
  })

  it('should archive an existing event and return its id', async () => {
    const existingEvent = existingEventFixture()

    readRepo.findByIdInScope.mockResolvedValue(existingEvent)
    writeRepo.save.mockImplementation(async (event) => event)
    authz.assert.mockResolvedValue(undefined)

    const command = new DeleteEventCommand(existingEvent.id, 'u1')
    const result = await handler.execute(command)

    expect(result).toEqual({ id: existingEvent.id })
    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(readRepo.findByIdInScope).toHaveBeenCalledWith(existingEvent.id, unrestrictedScope)
    expect(authz.assert).toHaveBeenCalledWith('u1', 'event.delete', existingEvent.id)
    expect(writeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'archived' }))
  })

  it('should throw 404 when event does not exist', async () => {
    readRepo.findByIdInScope.mockResolvedValue(null)

    const command = new DeleteEventCommand('non-existent-id', 'u1')

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    // The coordinator-flagged case: a caller whose template permits
    // `event.delete` in general, but the target event belongs to another
    // tenant. The scoped load must be what denies it — findByIdInScope
    // returns null exactly as it would for an unknown id, so the caller
    // cannot distinguish "not mine" from "does not exist" (no enumeration
    // of other tenants' event ids by probing UUIDs).
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    readRepo.findByIdInScope.mockResolvedValueOnce(null)

    const command = new DeleteEventCommand('550e8400-e29b-41d4-a716-446655440000', 'u1')
    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(readRepo.findByIdInScope).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      restrictedScope,
    )
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('should throw when the caller lacks event.delete', async () => {
    readRepo.findByIdInScope.mockResolvedValue(existingEventFixture())
    authz.assert.mockRejectedValue(new Error('Insufficient permissions'))

    const command = new DeleteEventCommand('550e8400-e29b-41d4-a716-446655440000', 'u1')

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
