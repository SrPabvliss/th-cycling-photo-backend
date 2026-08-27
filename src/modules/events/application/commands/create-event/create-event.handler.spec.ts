import type { EventConfigurationService } from '@events/application/services/event-configuration.service'
import { Event } from '@events/domain/entities'
import { IEventPayoutMethodRepository, IEventWriteRepository } from '@events/domain/ports'
import type { IEventOperatorRepository } from '@events/domain/ports/event-operator-repository.port'
import { LocationValidator } from '@locations/application/services'
import { AuditContext } from '@shared/application'
import { AppException } from '@shared/domain'
import type { PrismaService } from '@shared/infrastructure'
import type { IUserReadRepository } from '@users/domain/ports'
import { TenantContract } from '../../../../contracts/domain/entities/tenant-contract.entity'
import type { IContractRepository } from '../../../../contracts/domain/ports/contract-repository.port'
import type { ITenantRepository } from '../../../../tenants/domain/ports/tenant-repository.port'
import { CreateEventCommand } from './create-event.command'
import { CreateEventHandler } from './create-event.handler'

describe('CreateEventHandler', () => {
  let handler: CreateEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let operatorRepo: jest.Mocked<IEventOperatorRepository>
  let userRepo: jest.Mocked<IUserReadRepository>
  let tenantRepo: jest.Mocked<ITenantRepository>
  let contractRepo: jest.Mocked<IContractRepository>
  let payoutRepo: jest.Mocked<IEventPayoutMethodRepository>
  let locationValidator: jest.Mocked<LocationValidator>
  let configService: jest.Mocked<EventConfigurationService>
  let kvStorage: { write: jest.Mock; writeBulk: jest.Mock; delete: jest.Mock }

  const activeContract = TenantContract.rehydrate({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    tenantId: '11111111-1111-4111-8111-111111111111',
    commercialName: 'Foto Andes',
    eventsTotal: 10,
    photosPerEvent: 500,
    status: 'accepted',
    validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    termsVersion: 'v1',
    acceptedAt: new Date(),
    revokedAt: null,
  })

  const futureStart = new Date()
  futureStart.setFullYear(futureStart.getFullYear() + 1)
  const futureEnd = new Date(futureStart)
  futureEnd.setDate(futureEnd.getDate() + 2)

  const creatorId = '550e8400-e29b-41d4-a716-446655440000'
  const creatorTenantId = '11111111-1111-4111-8111-111111111111'
  const audit = new AuditContext(creatorId)

  beforeEach(() => {
    writeRepo = {
      save: jest.fn(),
      updatePhotoQuota: jest.fn(),
    } as jest.Mocked<IEventWriteRepository>

    operatorRepo = {
      assign: jest.fn().mockResolvedValue(undefined),
      unassign: jest.fn(),
      findByEvent: jest.fn(),
      isAssigned: jest.fn(),
      findFirstOperatorId: jest.fn().mockResolvedValue(null),
    } as jest.Mocked<IEventOperatorRepository>

    userRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findTenantId: jest.fn().mockResolvedValue(creatorTenantId),
      getUsersList: jest.fn(),
      getUserDetail: jest.fn(),
      findActiveAdminIds: jest.fn(),
      getBuyersList: jest.fn(),
    } as jest.Mocked<IUserReadRepository>

    tenantRepo = {
      updateEventPhotoQuotaDefault: jest.fn(),
      checkQuota: jest
        .fn()
        .mockResolvedValue({ quota: 10, used: 0, isPlatform: false, defaultEventPhotoQuota: null }),
    } as jest.Mocked<ITenantRepository>

    contractRepo = {
      findByTokenHash: jest.fn(),
      findById: jest.fn(),
      findPendingByUserId: jest.fn(),
      listAll: jest.fn(),
      listByUser: jest.fn(),
      create: jest.fn(),
      findNextUsable: jest.fn(),
      findMostRecentAccepted: jest.fn(),
      acceptInTransaction: jest.fn(),
      revoke: jest.fn(),
      rotateToken: jest.fn(),
      consumeSlot: jest.fn().mockResolvedValue(activeContract),
    } as jest.Mocked<IContractRepository>

    payoutRepo = {
      findByEventId: jest.fn(),
      replaceForEvent: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<IEventPayoutMethodRepository>

    locationValidator = {
      validate: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LocationValidator>

    configService = {
      findMissingRequirements: jest.fn(),
      assertProfileComplete: jest.fn().mockResolvedValue(undefined),
      assertConfigurationComplete: jest.fn(),
      verifyNewPayphones: jest.fn().mockResolvedValue(undefined),
      materialise: jest.fn().mockResolvedValue({
        brand: {
          publicName: 'Foto Andes',
          watermarkStorageKey: 'tenants/t-1/watermark/uuid-logo.png',
          whatsappNumber: '+593987654321',
        },
        payoutMethods: [
          {
            provider: 'payphone',
            isActive: true,
          },
          {
            provider: 'bank_transfer',
            isActive: true,
          },
        ],
      }),
    } as unknown as jest.Mocked<EventConfigurationService>

    const prisma = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({})),
    } as unknown as PrismaService

    kvStorage = {
      write: jest.fn().mockResolvedValue(undefined),
      writeBulk: jest.fn(),
      delete: jest.fn(),
    }

    handler = new CreateEventHandler(
      writeRepo,
      operatorRepo,
      userRepo,
      tenantRepo,
      contractRepo,
      payoutRepo,
      kvStorage,
      locationValidator,
      configService,
      prisma,
    )
  })

  it('should create and save event, returning id', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    const result = await handler.execute(command)

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    expect(result.slug).toBe(writeRepo.save.mock.calls[0][0].slug)
    expect(locationValidator.validate).toHaveBeenCalledWith(null, null)
    expect(writeRepo.save).toHaveBeenCalledTimes(1)
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Event',
        status: 'active',
      }),
      expect.anything(),
    )
  })

  it('creates the event with the creator tenant', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    await handler.execute(command)

    expect(userRepo.findTenantId).toHaveBeenCalledWith(creatorId)
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: creatorTenantId }),
      expect.anything(),
    )
  })

  it('rejects creation when the creator has no tenant', async () => {
    userRepo.findTenantId.mockResolvedValue(null)
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    await expect(handler.execute(command)).rejects.toThrow('event.creator_tenant_required')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('creates the event carrying the contract id and its photosPerEvent as photo_quota', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    await handler.execute(command)

    expect(contractRepo.consumeSlot).toHaveBeenCalledWith(creatorTenantId, expect.anything())
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: activeContract.id, photoQuota: 500 }),
      expect.anything(),
    )
  })

  it('carries a null photo_quota when the contract allows unlimited photos', async () => {
    contractRepo.consumeSlot.mockResolvedValue(
      TenantContract.rehydrate({
        id: activeContract.id,
        userId: activeContract.userId,
        tenantId: activeContract.tenantId,
        commercialName: activeContract.commercialName,
        eventsTotal: activeContract.eventsTotal,
        photosPerEvent: null,
        status: activeContract.status,
        validUntil: activeContract.validUntil,
        termsVersion: activeContract.termsVersion,
        acceptedAt: activeContract.acceptedAt,
        revokedAt: activeContract.revokedAt,
      }),
    )
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    await handler.execute(command)

    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ photoQuota: null }),
      expect.anything(),
    )
  })

  it('rejects creation when the tenant has no contract with an available slot', async () => {
    contractRepo.consumeSlot.mockResolvedValue(null)
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    await expect(handler.execute(command)).rejects.toThrow('event.no_contract_available')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('rejects creation when the tenant only has an expired contract', async () => {
    contractRepo.consumeSlot.mockResolvedValue(null)
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    await expect(handler.execute(command)).rejects.toThrow('event.no_contract_available')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('lets the platform tenant create without any contract at all', async () => {
    tenantRepo.checkQuota.mockResolvedValue({
      quota: 1,
      used: 99,
      isPlatform: true,
      defaultEventPhotoQuota: 42,
    })
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    await expect(handler.execute(command)).resolves.toHaveProperty('id')
    expect(contractRepo.consumeSlot).not.toHaveBeenCalled()
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: null, photoQuota: 42 }),
      expect.anything(),
    )
  })

  it('should create event with valid province and canton', async () => {
    const command = new CreateEventCommand('Test Event', futureStart, futureEnd, 18, 1, 1, audit)

    writeRepo.save.mockImplementation(async (event: Event) => event)

    const result = await handler.execute(command)

    expect(result).toHaveProperty('id')
    expect(locationValidator.validate).toHaveBeenCalledWith(18, 1)
  })

  it('should propagate location validation errors', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      999,
      null,
      1,
      audit,
    )

    locationValidator.validate.mockRejectedValue(
      AppException.businessRule('event.province_not_found'),
    )

    await expect(handler.execute(command)).rejects.toThrow('event.province_not_found')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('should propagate entity validation errors without calling save', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      new Date('2026-06-17'),
      new Date('2026-06-15'),
      null,
      null,
      1,
      audit,
    )

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('refuses to create when the effective configuration is incomplete', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    configService.assertConfigurationComplete.mockImplementation(() => {
      throw AppException.businessRule('event.configuration_incomplete', false, {
        missing: 'watermark',
      })
    })

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'event.configuration_incomplete',
    })
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('creates the event when the profile is empty but the selection supplies everything', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
      {
        publicName: 'Foto Andes',
        watermarkStorageKey: 'tenants/t-1/watermark/uuid-logo.png',
        whatsappNumber: '+593987654321',
        payoutMethods: [
          { source: 'new', provider: 'payphone', phone: '+593912345678' },
          {
            source: 'new',
            provider: 'bank_transfer',
            bankName: 'Pichincha',
            accountNumber: '2100112233',
            accountType: 'savings',
            accountHolder: 'Ana Perez',
            holderIdentification: '1804567890',
          },
        ],
      },
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    await expect(handler.execute(command)).resolves.toEqual({
      id: expect.any(String),
      slug: expect.any(String),
    })
    expect(configService.verifyNewPayphones).toHaveBeenCalledWith(
      command.configuration?.payoutMethods,
    )
  })

  it('propagates an unverified payphone number and never saves the event', async () => {
    configService.verifyNewPayphones.mockRejectedValue(
      AppException.businessRule('payment.phone_not_registered', false, {
        rule: 'phone_not_registered',
      }),
    )
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
      {
        publicName: 'Foto Andes',
        watermarkStorageKey: 'tenants/t-1/watermark/uuid-logo.png',
        whatsappNumber: '+593987654321',
        payoutMethods: [{ source: 'new', provider: 'payphone', phone: '+593912345678' }],
      },
    )

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'payment.phone_not_registered',
    })
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('rejects when the effective configuration has no bank transfer, even though the profile has one', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
      {
        payoutMethods: [{ source: 'profile', id: 'profile-payphone-id' }],
      },
    )

    configService.materialise.mockResolvedValue({
      brand: {
        publicName: 'Foto Andes',
        watermarkStorageKey: 'tenants/t-1/watermark/uuid-logo.png',
        whatsappNumber: '+593987654321',
      },
      payoutMethods: [{ provider: 'payphone', isActive: true } as never],
    })
    configService.assertConfigurationComplete.mockImplementation(() => {
      throw AppException.businessRule('event.configuration_incomplete', false, {
        missing: 'bankTransfer',
      })
    })

    await expect(handler.execute(command)).rejects.toThrow()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('rejects when the effective configuration has no public name', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
      {
        payoutMethods: [
          { source: 'new', provider: 'payphone', phone: '+593912345678' },
          {
            source: 'new',
            provider: 'bank_transfer',
            bankName: 'Pichincha',
            accountNumber: '2100112233',
            accountType: 'savings',
            accountHolder: 'Ana Perez',
            holderIdentification: '1804567890',
          },
        ],
      },
    )

    configService.materialise.mockResolvedValue({
      brand: {
        publicName: null,
        watermarkStorageKey: 'tenants/t-1/watermark/uuid-logo.png',
        whatsappNumber: '+593987654321',
      },
      payoutMethods: [
        { provider: 'payphone', isActive: true } as never,
        { provider: 'bank_transfer', isActive: true } as never,
      ],
    })
    configService.assertConfigurationComplete.mockImplementation(() => {
      throw AppException.businessRule('event.configuration_incomplete', false, {
        missing: 'publicName',
      })
    })

    await expect(handler.execute(command)).rejects.toThrow()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('freezes the configuration onto the created event', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    await handler.execute(command)

    expect(configService.materialise).toHaveBeenCalledWith(
      creatorTenantId,
      expect.any(String),
      undefined,
    )
    expect(payoutRepo.replaceForEvent).toHaveBeenCalled()
  })

  it('registers the frozen watermark in KV under the event id', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    configService.materialise.mockResolvedValue({
      brand: {
        publicName: 'Foto Andes',
        watermarkStorageKey: 'tenants/t-1/watermark/uuid-logo.png',
        whatsappNumber: '+593987654321',
      },
      payoutMethods: [],
    })

    const result = await handler.execute(command)

    expect(kvStorage.write).toHaveBeenCalledWith(
      `wm-${result.id}`,
      'tenants/t-1/watermark/uuid-logo.png',
    )
  })

  it('writes no KV entry when the event froze no watermark', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    configService.materialise.mockResolvedValue({
      brand: { publicName: null, watermarkStorageKey: null, whatsappNumber: null },
      payoutMethods: [],
    })

    await handler.execute(command)

    expect(kvStorage.write).not.toHaveBeenCalled()
  })
})
