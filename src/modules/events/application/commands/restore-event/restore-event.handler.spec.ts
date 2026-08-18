import { Event } from '@events/domain/entities'
import type { IEventReadRepository, IEventWriteRepository } from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { RestoreEventCommand } from './restore-event.command'
import { RestoreEventHandler } from './restore-event.handler'

describe('RestoreEventHandler', () => {
  let handler: RestoreEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let readRepo: jest.Mocked<IEventReadRepository>
  let authz: jest.Mocked<IAuthorizationService>
  const unrestrictedScope = EventScope.unrestricted()

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const command = new RestoreEventCommand('550e8400-e29b-41d4-a716-446655440000', 'u1')

  const makeEvent = (overrides: Partial<Parameters<typeof Event.fromPersistence>[0]> = {}): Event =>
    Event.fromPersistence({
      slug: 'test-event',
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'Vuelta Ciclística',
      startDate: futureDate,
      endDate: futureDate,
      provinceId: null,
      cantonId: null,
      eventTypeId: 1,
      status: 'archived',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(),
      ...overrides,
    })

  beforeEach(() => {
    writeRepo = {
      save: jest.fn(),
    } as unknown as jest.Mocked<IEventWriteRepository>

    readRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn(),
    } as unknown as jest.Mocked<IEventReadRepository>

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as unknown as jest.Mocked<IAuthorizationService>

    handler = new RestoreEventHandler(writeRepo, readRepo, authz)
  })

  it('throws NOT_FOUND when the event does not exist', async () => {
    readRepo.findByIdInScope.mockResolvedValueOnce(null)
    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the archived event exists but is outside the caller scope', async () => {
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    readRepo.findByIdInScope.mockResolvedValueOnce(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    // includeArchived=true is required here — restore's whole purpose is to
    // find a soft-deleted event — the scope must still be applied on top of it.
    expect(readRepo.findByIdInScope).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      restrictedScope,
      true,
    )
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('rejects when the caller holds event.restore in general but is denied on this event', async () => {
    readRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('restores the event and persists it, passing includeArchived=true to the scoped load', async () => {
    readRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())
    writeRepo.save.mockImplementation(async (event) => event)

    const result = await handler.execute(command)

    expect(readRepo.findByIdInScope).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      unrestrictedScope,
      true,
    )
    expect(authz.assert).toHaveBeenCalledWith(
      'u1',
      'event.restore',
      '550e8400-e29b-41d4-a716-446655440000',
    )
    expect(writeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }))
    expect(result).toEqual({ id: '550e8400-e29b-41d4-a716-446655440000' })
  })
})
