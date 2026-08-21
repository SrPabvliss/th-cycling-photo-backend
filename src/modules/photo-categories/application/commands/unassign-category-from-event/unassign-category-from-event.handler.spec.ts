import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import type { IPhotoCategoryWriteRepository } from '../../../domain/ports'
import { UnassignCategoryFromEventCommand } from './unassign-category-from-event.command'
import { UnassignCategoryFromEventHandler } from './unassign-category-from-event.handler'

describe('UnassignCategoryFromEventHandler', () => {
  let handler: UnassignCategoryFromEventHandler
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let writeRepo: jest.Mocked<IPhotoCategoryWriteRepository>
  let authz: jest.Mocked<IAuthorizationService>

  const EVENT_ID = '550e8400-e29b-41d4-a716-446655440000'
  const command = new UnassignCategoryFromEventCommand(EVENT_ID, 7, 'caller-1')

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const makeEvent = (): Event =>
    Event.fromPersistence({
      slug: 'test-event',
      id: EVENT_ID,
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

  beforeEach(() => {
    eventReadRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn().mockResolvedValue(makeEvent()),
    } as unknown as jest.Mocked<IEventReadRepository>

    writeRepo = {
      unassignFromEvent: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IPhotoCategoryWriteRepository>

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(EventScope.unrestricted()),
    } as unknown as jest.Mocked<IAuthorizationService>

    handler = new UnassignCategoryFromEventHandler(writeRepo, eventReadRepo, authz)
  })

  it('throws NOT_FOUND when the event does not exist', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.unassignFromEvent).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    // Ruling 21. This handler previously performed NO load at all: it wrote
    // straight through on the caller-supplied eventId, so a tenant holding
    // photo_category.event.remove (it is in the TENANT template) could strip
    // any event whose UUID it knew of its category assignments.
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(eventReadRepo.findByIdInScope).toHaveBeenCalledWith(EVENT_ID, restrictedScope)
    expect(eventReadRepo.findById).not.toHaveBeenCalled()
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.unassignFromEvent).not.toHaveBeenCalled()
  })

  it('rejects when the caller holds the key in general but is denied on this event', async () => {
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(writeRepo.unassignFromEvent).not.toHaveBeenCalled()
  })

  it('unassigns once the scoped event is found and permission holds', async () => {
    await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith('caller-1', 'photo_category.event.remove', EVENT_ID)
    expect(writeRepo.unassignFromEvent).toHaveBeenCalledWith(EVENT_ID, 7)
  })
})
