import { Event } from '@events/domain/entities'
import type { IEventReadRepository, IEventWriteRepository } from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { SetEventFreezeCommand } from './set-event-freeze.command'
import { SetEventFreezeHandler } from './set-event-freeze.handler'

describe('SetEventFreezeHandler', () => {
  let handler: SetEventFreezeHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let readRepo: jest.Mocked<IEventReadRepository>
  let authz: jest.Mocked<IAuthorizationService>

  const eventId = '550e8400-e29b-41d4-a716-446655440000'
  const command = new SetEventFreezeCommand(eventId, true, 'tenant-admin')

  const makeEvent = (): Event =>
    Event.fromPersistence({
      id: eventId,
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'Vuelta Ciclística',
      slug: 'vuelta-ciclistica',
      startDate: new Date('2026-06-15'),
      endDate: new Date('2026-06-17'),
      provinceId: null,
      cantonId: null,
      eventTypeId: 1,
      status: 'active',
      snapPublicName: null,
      snapWatermarkStorageKey: null,
      snapWhatsappNumber: null,
      isFrozen: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

  beforeEach(() => {
    writeRepo = { save: jest.fn() } as unknown as jest.Mocked<IEventWriteRepository>
    readRepo = {
      findByIdInScope: jest.fn(),
    } as unknown as jest.Mocked<IEventReadRepository>
    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(EventScope.unrestricted()),
    } as unknown as jest.Mocked<IAuthorizationService>

    handler = new SetEventFreezeHandler(writeRepo, readRepo, authz)
  })

  // event.freeze is platformOnly in the catalog, so a tenant admin is rejected by authz.assert.
  it('rejects a non-platform principal without persisting the flag', async () => {
    readRepo.findByIdInScope.mockResolvedValueOnce(makeEvent())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')

    expect(authz.assert).toHaveBeenCalledWith('tenant-admin', 'event.freeze', eventId)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
