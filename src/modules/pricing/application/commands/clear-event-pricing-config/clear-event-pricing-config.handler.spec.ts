import type { FreezeStateService } from '@events/application/services/freeze-state.service'
import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import type { IEventPricingWriteRepository } from '@pricing/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { ClearEventPricingConfigCommand } from './clear-event-pricing-config.command'
import { ClearEventPricingConfigHandler } from './clear-event-pricing-config.handler'

describe('ClearEventPricingConfigHandler', () => {
  let handler: ClearEventPricingConfigHandler
  let repo: jest.Mocked<IEventPricingWriteRepository>
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let authz: jest.Mocked<IAuthorizationService>

  const EVENT_ID = '550e8400-e29b-41d4-a716-446655440000'
  const command = new ClearEventPricingConfigCommand(EVENT_ID, 'caller-1')

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
    repo = {
      upsertConfig: jest.fn(),
      deleteConfig: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IEventPricingWriteRepository>

    eventReadRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn().mockResolvedValue(makeEvent()),
    } as unknown as jest.Mocked<IEventReadRepository>

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(EventScope.unrestricted()),
    } as unknown as jest.Mocked<IAuthorizationService>

    const freeze = {
      assertNotFrozen: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FreezeStateService>

    handler = new ClearEventPricingConfigHandler(repo, eventReadRepo, authz, freeze)
  })

  it('throws NOT_FOUND when the event does not exist', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
    expect(repo.deleteConfig).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    // Ruling 21 — see SetEventPricingConfigHandler's spec for the reasoning.
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    eventReadRepo.findByIdInScope.mockResolvedValueOnce(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(eventReadRepo.findByIdInScope).toHaveBeenCalledWith(EVENT_ID, restrictedScope)
    expect(eventReadRepo.findById).not.toHaveBeenCalled()
    expect(authz.assert).not.toHaveBeenCalled()
    expect(repo.deleteConfig).not.toHaveBeenCalled()
  })

  it('rejects when the caller holds the key in general but is denied on this event', async () => {
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(repo.deleteConfig).not.toHaveBeenCalled()
  })

  it('clears the config once the scoped event is found and permission holds', async () => {
    await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith('caller-1', 'pricing.config.clear', EVENT_ID)
    expect(repo.deleteConfig).toHaveBeenCalledWith(EVENT_ID)
  })
})
