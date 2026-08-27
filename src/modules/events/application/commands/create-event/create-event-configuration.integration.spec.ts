import { CreateEventCommand } from '@events/application/commands/create-event/create-event.command'
import { CreateEventHandler } from '@events/application/commands/create-event/create-event.handler'
import { EventConfigurationService } from '@events/application/services/event-configuration.service'
import {
  EVENT_OPERATOR_REPOSITORY,
  EVENT_PAYOUT_METHOD_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventOperatorRepository,
} from '@events/domain/ports'
import { EventPayoutMethodRepository } from '@events/infrastructure/repositories/event-payout-method.repository'
import { EventWriteRepository } from '@events/infrastructure/repositories/event-write.repository'
import { LocationValidator } from '@locations/application/services'
import { LOCATION_READ_REPOSITORY } from '@locations/domain/ports'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { AuditContext } from '@shared/application'
import { type IKvStorageAdapter, KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { PAYMENT_GATEWAY_REGISTRY } from '@shared/payment-gateways'
import { TenantPayoutMethod } from '@tenants/domain/entities/tenant-payout-method.entity'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '@tenants/domain/ports/tenant-payout-method-repository.port'
import { TENANT_PROFILE_REPOSITORY } from '@tenants/domain/ports/tenant-profile-repository.port'
import { TENANT_REPOSITORY } from '@tenants/domain/ports/tenant-repository.port'
import { TenantRepository } from '@tenants/infrastructure/repositories/tenant.repository'
import { TenantPayoutMethodRepository } from '@tenants/infrastructure/repositories/tenant-payout-method.repository'
import { TenantProfileRepository } from '@tenants/infrastructure/repositories/tenant-profile.repository'
import { USER_READ_REPOSITORY } from '@users/domain/ports'
import { UserReadRepository } from '@users/infrastructure/repositories/user-read.repository'
import configuration from '../../../../../config/configuration'
import { validate } from '../../../../../config/env.validation'
import { CONTRACT_REPOSITORY } from '../../../../contracts/domain/ports/contract-repository.port'
import { ContractRepository } from '../../../../contracts/infrastructure/repositories/contract.repository'

describe('create event configuration completeness', () => {
  let module: TestingModule
  let prisma: PrismaService
  let createEvent: CreateEventHandler
  let payoutRepo: ITenantPayoutMethodRepository

  let tenantId: string
  let userId: string
  const createdEventIds: string[] = []

  const gateway = {
    provider: 'payphone',
    verifyReceiver: jest.fn().mockResolvedValue(true),
    platformCredentials: jest.fn().mockReturnValue({}),
    buildCheckoutIntent: jest.fn(),
    confirm: jest.fn(),
    commissionCents: jest.fn(),
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
          validate,
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [
        PrismaService,
        { provide: EVENT_WRITE_REPOSITORY, useClass: EventWriteRepository },
        { provide: EVENT_PAYOUT_METHOD_REPOSITORY, useClass: EventPayoutMethodRepository },
        {
          provide: EVENT_OPERATOR_REPOSITORY,
          useValue: {
            findFirstOperatorId: async () => null,
          } satisfies Partial<IEventOperatorRepository>,
        },
        { provide: TENANT_REPOSITORY, useClass: TenantRepository },
        { provide: TENANT_PROFILE_REPOSITORY, useClass: TenantProfileRepository },
        { provide: TENANT_PAYOUT_METHOD_REPOSITORY, useClass: TenantPayoutMethodRepository },
        { provide: USER_READ_REPOSITORY, useClass: UserReadRepository },
        { provide: CONTRACT_REPOSITORY, useClass: ContractRepository },
        {
          provide: LOCATION_READ_REPOSITORY,
          useValue: {
            provinceExists: async () => true,
            cantonExistsInProvince: async () => true,
          },
        },
        { provide: PAYMENT_GATEWAY_REGISTRY, useValue: { get: () => gateway } },
        {
          provide: KV_STORAGE_ADAPTER,
          useValue: {
            write: jest.fn().mockResolvedValue(undefined),
            writeBulk: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          } satisfies IKvStorageAdapter,
        },
        EventConfigurationService,
        LocationValidator,
        CreateEventHandler,
      ],
    }).compile()

    prisma = module.get(PrismaService)
    createEvent = module.get(CreateEventHandler)
    payoutRepo = module.get(TENANT_PAYOUT_METHOD_REPOSITORY)
  })

  afterAll(async () => {
    if (module) await module.close()
  })

  beforeEach(() => {
    gateway.verifyReceiver.mockClear().mockResolvedValue(true)
  })

  afterEach(async () => {
    await prisma.eventPayoutMethod.deleteMany({ where: { event_id: { in: createdEventIds } } })
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
    createdEventIds.length = 0

    if (tenantId) {
      await prisma.tenantPayoutMethod.deleteMany({ where: { tenant_id: tenantId } })
      await prisma.tenantContract.deleteMany({ where: { tenant_id: tenantId } })
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } })
    }
    if (tenantId) {
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
    }

    const remainingEvents = await prisma.event.findMany({
      where: { id: { in: createdEventIds } },
    })
    expect(remainingEvents).toHaveLength(0)
    if (tenantId) {
      const remainingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
      expect(remainingTenant).toBeNull()
    }
    if (userId) {
      const remainingUser = await prisma.user.findUnique({ where: { id: userId } })
      expect(remainingUser).toBeNull()
    }

    tenantId = ''
    userId = ''
  })

  async function setUpTenant(profile: {
    publicName: string | null
    watermarkStorageKey: string | null
    whatsappNumber: string | null
  }) {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Foto Andes Test',
        is_platform: false,
        public_name: profile.publicName,
        watermark_storage_key: profile.watermarkStorageKey,
        whatsapp_number: profile.whatsappNumber,
        event_quota: 10,
      },
    })
    tenantId = tenant.id

    const tenantTpl = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'tenant' },
    })

    const user = await prisma.user.create({
      data: {
        email: `create-event-config-${crypto.randomUUID()}@t.com`,
        password_hash: 'x',
        permission_template_id: tenantTpl.id,
        tenant_id: tenant.id,
      },
    })
    userId = user.id

    await prisma.tenantContract.create({
      data: {
        user_id: user.id,
        tenant_id: tenant.id,
        commercial_name: 'Foto Andes Test',
        events_total: 10,
        photos_per_event: 100,
        status: 'accepted',
        token_hash: crypto.randomUUID(),
        valid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        terms_version: 'v1',
        accepted_at: new Date(),
      },
    })

    return { tenant, user }
  }

  const eventTypeId = async () => (await prisma.eventType.findFirstOrThrow()).id

  it('persists two new-source payout methods with source_payout_method_id null and ordered sort_order', async () => {
    await setUpTenant({
      publicName: 'Foto Andes',
      watermarkStorageKey: 'tenants/placeholder/watermark.png',
      whatsappNumber: '0991234567',
    })

    const command = new CreateEventCommand(
      'Vuelta Nueva Config',
      new Date('2026-09-01'),
      new Date('2026-09-02'),
      null,
      null,
      await eventTypeId(),
      new AuditContext(userId),
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

    const { id: eventId } = await createEvent.execute(command)
    createdEventIds.push(eventId)

    const rows = await prisma.eventPayoutMethod.findMany({
      where: { event_id: eventId },
      orderBy: { sort_order: 'asc' },
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      provider: 'payphone',
      source_payout_method_id: null,
      sort_order: 0,
    })
    expect(rows[1]).toMatchObject({
      provider: 'bank_transfer',
      source_payout_method_id: null,
      sort_order: 1,
    })
  })

  it('persists a profile-source payout method carrying the tenant method id', async () => {
    await setUpTenant({
      publicName: 'Foto Andes',
      watermarkStorageKey: 'tenants/placeholder/watermark.png',
      whatsappNumber: '0991234567',
    })

    const bankMethod = TenantPayoutMethod.createBankTransfer(
      tenantId,
      {
        bankName: 'Pichincha',
        accountNumber: '2100112233',
        accountType: 'savings',
        accountHolder: 'Ana Perez',
        holderIdentification: '1804567890',
      },
      userId,
    )
    await payoutRepo.save(bankMethod)

    const payphoneMethod = TenantPayoutMethod.createPayphoneSplit(tenantId, '0991234567', userId)
    payphoneMethod.markVerified()
    await payoutRepo.save(payphoneMethod)

    const command = new CreateEventCommand(
      'Vuelta Config Perfil',
      new Date('2026-09-05'),
      new Date('2026-09-06'),
      null,
      null,
      await eventTypeId(),
      new AuditContext(userId),
      {
        payoutMethods: [
          { source: 'profile', id: bankMethod.id },
          { source: 'profile', id: payphoneMethod.id },
        ],
      },
    )

    const { id: eventId } = await createEvent.execute(command)
    createdEventIds.push(eventId)

    const rows = await prisma.eventPayoutMethod.findMany({
      where: { event_id: eventId },
      orderBy: { sort_order: 'asc' },
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      provider: 'bank_transfer',
      source_payout_method_id: bankMethod.id,
    })
    expect(rows[1]).toMatchObject({
      provider: 'payphone',
      source_payout_method_id: payphoneMethod.id,
    })
  })

  it('persists a wizard-supplied watermark key distinct from the profile key', async () => {
    await setUpTenant({
      publicName: 'Foto Andes',
      watermarkStorageKey: 'tenants/placeholder/watermark-profile.png',
      whatsappNumber: '0991234567',
    })

    const bankMethod = TenantPayoutMethod.createBankTransfer(
      tenantId,
      {
        bankName: 'Pichincha',
        accountNumber: '2100112233',
        accountType: 'savings',
        accountHolder: 'Ana Perez',
        holderIdentification: '1804567890',
      },
      userId,
    )
    await payoutRepo.save(bankMethod)
    const payphoneMethod = TenantPayoutMethod.createPayphoneSplit(tenantId, '0991234567', userId)
    payphoneMethod.markVerified()
    await payoutRepo.save(payphoneMethod)

    const newWatermarkKey = `tenants/${tenantId}/watermark/event-specific.png`

    const command = new CreateEventCommand(
      'Vuelta Watermark Propio',
      new Date('2026-09-10'),
      new Date('2026-09-11'),
      null,
      null,
      await eventTypeId(),
      new AuditContext(userId),
      { watermarkStorageKey: newWatermarkKey },
    )

    const { id: eventId } = await createEvent.execute(command)
    createdEventIds.push(eventId)

    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })

    expect(event.snap_watermark_storage_key).toBe(newWatermarkKey)
    expect(event.snap_watermark_storage_key).not.toBe('tenants/placeholder/watermark-profile.png')
  })

  it('throws and leaves no event row when the selection carries only a payphone', async () => {
    await setUpTenant({
      publicName: 'Foto Andes',
      watermarkStorageKey: 'tenants/placeholder/watermark.png',
      whatsappNumber: '0991234567',
    })

    const command = new CreateEventCommand(
      'Vuelta Incompleta',
      new Date('2026-09-15'),
      new Date('2026-09-16'),
      null,
      null,
      await eventTypeId(),
      new AuditContext(userId),
      {
        payoutMethods: [{ source: 'new', provider: 'payphone', phone: '+593912345678' }],
      },
    )

    await expect(createEvent.execute(command)).rejects.toMatchObject({
      messageKey: 'event.configuration_incomplete',
    })

    const events = await prisma.event.findMany({ where: { tenant_id: tenantId } })
    expect(events).toHaveLength(0)
  })
})
