import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import type { IEventOperatorRepository } from '@events/domain/ports/event-operator-repository.port'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { AssignOperatorCommand } from './assign-operator.command'
import { AssignOperatorHandler } from './assign-operator.handler'

describe('AssignOperatorHandler', () => {
  let handler: AssignOperatorHandler
  let operatorRepo: jest.Mocked<IEventOperatorRepository>
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let authz: jest.Mocked<IAuthorizationService>
  const unrestrictedScope = EventScope.unrestricted()

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const command = new AssignOperatorCommand(
    '550e8400-e29b-41d4-a716-446655440000',
    'operator-1',
    'admin-1',
  )

  const makeEvent = (): Event =>
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
    })

  beforeEach(() => {
    operatorRepo = {
      assign: jest.fn().mockResolvedValue(undefined),
      unassign: jest.fn(),
      findByEvent: jest.fn(),
      isAssigned: jest.fn().mockResolvedValue(false),
      findFirstOperatorId: jest.fn(),
    } as unknown as jest.Mocked<IEventOperatorRepository>

    eventReadRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn(),
    } as unknown as jest.Mocked<IEventReadRepository>

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as unknown as jest.Mocked<IAuthorizationService>

    handler = new AssignOperatorHandler(operatorRepo, eventReadRepo, authz)
  })

  it('throws NOT_FOUND when the event does not exist', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(null)
    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
    expect(operatorRepo.assign).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(eventReadRepo.findByIdInScope).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      restrictedScope,
    )
    expect(authz.assert).not.toHaveBeenCalled()
    expect(operatorRepo.isAssigned).not.toHaveBeenCalled()
    expect(operatorRepo.assign).not.toHaveBeenCalled()
  })

  it('rejects when the caller holds event.collaborator.assign in general but is denied on this event', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(operatorRepo.assign).not.toHaveBeenCalled()
  })

  it('throws BUSINESS_RULE when the operator is already assigned', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())
    operatorRepo.isAssigned.mockResolvedValueOnce(true)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('BUSINESS_RULE')
    expect(operatorRepo.assign).not.toHaveBeenCalled()
  })

  it('assigns the operator once the scoped event is found and permission holds', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())

    await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith(
      'admin-1',
      'event.collaborator.assign',
      '550e8400-e29b-41d4-a716-446655440000',
    )
    expect(operatorRepo.assign).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'operator-1',
      'admin-1',
    )
  })
})
