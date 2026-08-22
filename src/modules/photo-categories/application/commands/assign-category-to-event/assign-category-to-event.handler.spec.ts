import type { FreezeStateService } from '@events/application/services/freeze-state.service'
import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import type {
  IPhotoCategoryReadRepository,
  IPhotoCategoryWriteRepository,
} from '../../../domain/ports'
import { AssignCategoryToEventCommand } from './assign-category-to-event.command'
import { AssignCategoryToEventHandler } from './assign-category-to-event.handler'

describe('AssignCategoryToEventHandler', () => {
  let handler: AssignCategoryToEventHandler
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let readRepo: jest.Mocked<IPhotoCategoryReadRepository>
  let writeRepo: jest.Mocked<IPhotoCategoryWriteRepository>
  let authz: jest.Mocked<IAuthorizationService>

  const EVENT_ID = '550e8400-e29b-41d4-a716-446655440000'
  const command = new AssignCategoryToEventCommand(EVENT_ID, 7, 'caller-1')

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

    readRepo = {
      findById: jest.fn().mockResolvedValue({ id: 7, name: 'Competencia' }),
    } as unknown as jest.Mocked<IPhotoCategoryReadRepository>

    writeRepo = {
      assignToEvent: jest.fn().mockResolvedValue('assignment-1'),
    } as unknown as jest.Mocked<IPhotoCategoryWriteRepository>

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(EventScope.unrestricted()),
    } as unknown as jest.Mocked<IAuthorizationService>

    const freeze = {
      assertNotFrozen: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FreezeStateService>

    handler = new AssignCategoryToEventHandler(eventReadRepo, readRepo, writeRepo, authz, freeze)
  })

  it('throws NOT_FOUND when the event does not exist', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.assignToEvent).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    // Ruling 21. The handler previously loaded the event with the UNSCOPED
    // findById and never resolved scope or asserted, so a tenant holding
    // photo_category.event.assign (it is in the TENANT template) could
    // rewrite the category assignments of any event whose UUID it knew.
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(eventReadRepo.findByIdInScope).toHaveBeenCalledWith(EVENT_ID, restrictedScope)
    expect(eventReadRepo.findById).not.toHaveBeenCalled()
    expect(authz.assert).not.toHaveBeenCalled()
    expect(readRepo.findById).not.toHaveBeenCalled()
    expect(writeRepo.assignToEvent).not.toHaveBeenCalled()
  })

  it('rejects when the caller holds the key in general but is denied on this event', async () => {
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(writeRepo.assignToEvent).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND when the category does not exist', async () => {
    readRepo.findById.mockResolvedValueOnce(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(writeRepo.assignToEvent).not.toHaveBeenCalled()
  })

  it('assigns once the scoped event is found and permission holds', async () => {
    const result = await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith('caller-1', 'photo_category.event.assign', EVENT_ID)
    expect(writeRepo.assignToEvent).toHaveBeenCalledWith(EVENT_ID, 7)
    expect(result).toEqual({ id: 'assignment-1' })
  })
})
