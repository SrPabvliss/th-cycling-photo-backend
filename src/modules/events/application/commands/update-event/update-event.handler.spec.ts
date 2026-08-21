import { Event } from '@events/domain/entities'
import type { IEventReadRepository, IEventWriteRepository } from '@events/domain/ports'
import type { LocationValidator } from '@locations/application/services'
import type { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { UpdateEventCommand } from './update-event.command'
import { UpdateEventHandler } from './update-event.handler'

describe('UpdateEventHandler', () => {
  let handler: UpdateEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let readRepo: jest.Mocked<IEventReadRepository>
  let authz: jest.Mocked<IAuthorizationService>
  let locationValidator: jest.Mocked<LocationValidator>
  const unrestrictedScope = EventScope.unrestricted()

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const audit = { userId: 'u1' } as AuditContext
  const command = new UpdateEventCommand(
    '550e8400-e29b-41d4-a716-446655440000',
    'Updated name',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    audit,
  )

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
      status: 'active',
      snapPublicName: null,
      snapWatermarkStorageKey: null,
      snapWhatsappNumber: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
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

    locationValidator = {
      validate: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LocationValidator>

    handler = new UpdateEventHandler(writeRepo, readRepo, authz, locationValidator)
  })

  it('throws INTERNAL when no audit context is provided', async () => {
    const noAuditCommand = new UpdateEventCommand('550e8400-e29b-41d4-a716-446655440000', 'x')
    const error = await handler.execute(noAuditCommand).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(authz.resolveEventScope).not.toHaveBeenCalled()
    expect(readRepo.findByIdInScope).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND when the event does not exist', async () => {
    readRepo.findByIdInScope.mockResolvedValueOnce(null)
    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    readRepo.findByIdInScope.mockResolvedValueOnce(null)

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

  it('rejects when the caller holds event.update in general but is denied on this event', async () => {
    readRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('updates the event and persists it', async () => {
    readRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())
    writeRepo.save.mockImplementation(async (event) => event)

    const result = await handler.execute(command)

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(authz.assert).toHaveBeenCalledWith(
      'u1',
      'event.update',
      '550e8400-e29b-41d4-a716-446655440000',
    )
    expect(writeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated name' }))
    expect(result).toEqual({ id: '550e8400-e29b-41d4-a716-446655440000' })
  })
})
