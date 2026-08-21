import type { EventConfigurationService } from '@events/application/services/event-configuration.service'
import { Event } from '@events/domain/entities'
import { IEventPayoutMethodRepository, IEventWriteRepository } from '@events/domain/ports'
import type { IEventOperatorRepository } from '@events/domain/ports/event-operator-repository.port'
import { LocationValidator } from '@locations/application/services'
import { AuditContext } from '@shared/application'
import { AppException } from '@shared/domain'
import type { IUserReadRepository } from '@users/domain/ports'
import type { ITenantRepository } from '../../../../tenants/domain/ports/tenant-repository.port'
import { CreateEventCommand } from './create-event.command'
import { CreateEventHandler } from './create-event.handler'

describe('CreateEventHandler', () => {
  let handler: CreateEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let operatorRepo: jest.Mocked<IEventOperatorRepository>
  let userRepo: jest.Mocked<IUserReadRepository>
  let tenantRepo: jest.Mocked<ITenantRepository>
  let payoutRepo: jest.Mocked<IEventPayoutMethodRepository>
  let locationValidator: jest.Mocked<LocationValidator>
  let configService: jest.Mocked<EventConfigurationService>

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
      getTenantsList: jest.fn(),
      updateEventQuota: jest.fn(),
      createTenantWithAdmin: jest.fn(),
      checkQuota: jest.fn().mockResolvedValue({ quota: 10, used: 0, isPlatform: false }),
    } as jest.Mocked<ITenantRepository>

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
      materialise: jest.fn().mockResolvedValue({
        brand: { publicName: null, watermarkStorageKey: null, whatsappNumber: null },
        payoutMethods: [],
      }),
    } as unknown as jest.Mocked<EventConfigurationService>

    handler = new CreateEventHandler(
      writeRepo,
      operatorRepo,
      userRepo,
      tenantRepo,
      payoutRepo,
      locationValidator,
      configService,
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
    expect(locationValidator.validate).toHaveBeenCalledWith(null, null)
    expect(writeRepo.save).toHaveBeenCalledTimes(1)
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Event',
        status: 'active',
      }),
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

  it('rejects creation when the tenant has exhausted its event quota', async () => {
    tenantRepo.checkQuota.mockResolvedValue({ quota: 5, used: 5, isPlatform: false })
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    await expect(handler.execute(command)).rejects.toThrow('tenant.quota_exceeded')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('lets the platform tenant exceed its quota', async () => {
    tenantRepo.checkQuota.mockResolvedValue({ quota: 1, used: 99, isPlatform: true })
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

  it('refuses to create when the profile is incomplete', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    configService.assertProfileComplete.mockRejectedValue(
      AppException.businessRule('event.configuration_incomplete', false, { missing: 'watermark' }),
    )

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'event.configuration_incomplete',
    })
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
})
