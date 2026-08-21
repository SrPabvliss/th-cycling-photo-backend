import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import type { IEventOperatorRepository } from '@events/domain/ports/event-operator-repository.port'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { UnassignOperatorCommand } from './unassign-operator.command'
import { UnassignOperatorHandler } from './unassign-operator.handler'

describe('UnassignOperatorHandler', () => {
  let handler: UnassignOperatorHandler
  let operatorRepo: jest.Mocked<IEventOperatorRepository>
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let authz: jest.Mocked<IAuthorizationService>
  const unrestrictedScope = EventScope.unrestricted()

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const command = new UnassignOperatorCommand(
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
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

  beforeEach(() => {
    operatorRepo = {
      assign: jest.fn(),
      unassign: jest.fn().mockResolvedValue(undefined),
      findByEvent: jest.fn(),
      isAssigned: jest.fn().mockResolvedValue(true),
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

    handler = new UnassignOperatorHandler(operatorRepo, eventReadRepo, authz)
  })

  it('throws NOT_FOUND when the event does not exist', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(null)
    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
    expect(operatorRepo.unassign).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    // This is the vulnerability this handler previously had with no fix at
    // all: it called authz.assert directly against the raw eventId with no
    // load, so any caller whose template granted event.collaborator.unassign
    // could unassign an operator from another tenant's event. The scoped
    // load must now be what denies it.
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
    expect(operatorRepo.unassign).not.toHaveBeenCalled()
  })

  it('rejects when the caller holds event.collaborator.unassign in general but is denied on this event', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(operatorRepo.unassign).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND for the operator relation when the operator is not assigned', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())
    operatorRepo.isAssigned.mockResolvedValueOnce(false)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(operatorRepo.unassign).not.toHaveBeenCalled()
  })

  it('unassigns the operator once the scoped event is found and permission holds', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())

    await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith(
      'admin-1',
      'event.collaborator.unassign',
      '550e8400-e29b-41d4-a716-446655440000',
    )
    expect(operatorRepo.unassign).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'operator-1',
    )
  })
})
