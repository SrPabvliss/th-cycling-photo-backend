import { EventConfigurationService } from '@events/application/services/event-configuration.service'
import { Event } from '@events/domain/entities'
import type {
  IEventPayoutMethodRepository,
  IEventReadRepository,
  IEventWriteRepository,
} from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import type { PrismaService } from '@shared/infrastructure'
import { UpdateEventConfigurationCommand } from './update-event-configuration.command'
import { UpdateEventConfigurationHandler } from './update-event-configuration.handler'

describe('UpdateEventConfigurationHandler', () => {
  let handler: UpdateEventConfigurationHandler
  let readRepo: jest.Mocked<IEventReadRepository>
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let payoutRepo: jest.Mocked<IEventPayoutMethodRepository>
  let authz: jest.Mocked<IAuthorizationService>
  let configService: jest.Mocked<EventConfigurationService>
  const unrestrictedScope = EventScope.unrestricted()

  const command = new UpdateEventConfigurationCommand(
    '550e8400-e29b-41d4-a716-446655440000',
    'u1',
    {
      publicName: 'New Public Name',
    },
  )

  const makeEvent = (status: 'active' | 'frozen'): Event =>
    Event.fromPersistence({
      slug: 'test-event',
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'Vuelta Ciclística',
      startDate: new Date(),
      endDate: new Date(),
      provinceId: null,
      cantonId: null,
      eventTypeId: 1,
      status,
      snapPublicName: null,
      snapWatermarkStorageKey: null,
      snapWhatsappNumber: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

  const frozenEvent = makeEvent('frozen')
  const activeEvent = makeEvent('active')

  beforeEach(() => {
    readRepo = {
      findByIdInScope: jest.fn(),
    } as unknown as jest.Mocked<IEventReadRepository>

    writeRepo = {
      save: jest.fn().mockImplementation(async (event) => event),
    } as unknown as jest.Mocked<IEventWriteRepository>

    payoutRepo = {
      findByEventId: jest.fn().mockResolvedValue([]),
      replaceForEvent: jest.fn(),
    } as unknown as jest.Mocked<IEventPayoutMethodRepository>

    authz = {
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as unknown as jest.Mocked<IAuthorizationService>

    configService = {
      rematerialise: jest.fn().mockResolvedValue({
        brand: { publicName: 'New Public Name', watermarkStorageKey: null, whatsappNumber: null },
        payoutMethods: [],
      }),
    } as unknown as jest.Mocked<EventConfigurationService>

    const prisma = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({})),
    } as unknown as PrismaService

    handler = new UpdateEventConfigurationHandler(
      readRepo,
      writeRepo,
      payoutRepo,
      authz,
      configService,
      prisma,
    )
  })

  it('refuses to edit a frozen event', async () => {
    readRepo.findByIdInScope.mockResolvedValue(frozenEvent)

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'event.frozen_not_configurable',
    })
    expect(payoutRepo.replaceForEvent).not.toHaveBeenCalled()
  })

  it('rewrites the snapshot for an active event', async () => {
    readRepo.findByIdInScope.mockResolvedValue(activeEvent)

    await handler.execute(command)

    expect(payoutRepo.replaceForEvent).toHaveBeenCalledWith(
      activeEvent.id,
      expect.any(Array),
      expect.anything(),
    )
  })
})
