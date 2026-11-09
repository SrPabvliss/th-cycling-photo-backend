import { CreateEventCommand } from '@events/application/commands/create-event/create-event.command'
import { CreateEventHandler } from '@events/application/commands/create-event/create-event.handler'
import { UpdateEventConfigurationCommand } from '@events/application/commands/update-event-configuration/update-event-configuration.command'
import { UpdateEventConfigurationHandler } from '@events/application/commands/update-event-configuration/update-event-configuration.handler'
import { GetEventConfigurationHandler } from '@events/application/queries/get-event-configuration/get-event-configuration.handler'
import { GetEventConfigurationQuery } from '@events/application/queries/get-event-configuration/get-event-configuration.query'
import { EventConfigurationService } from '@events/application/services/event-configuration.service'
import {
  EVENT_OPERATOR_REPOSITORY,
  EVENT_PAYOUT_METHOD_REPOSITORY,
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventOperatorRepository,
} from '@events/domain/ports'
import { EventPayoutMethodRepository } from '@events/infrastructure/repositories/event-payout-method.repository'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { EventWriteRepository } from '@events/infrastructure/repositories/event-write.repository'
import { LocationValidator } from '@locations/application/services'
import { LOCATION_READ_REPOSITORY } from '@locations/domain/ports'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { AuditContext } from '@shared/application'
import { AUTHORIZATION_SERVICE } from '@shared/authorization/domain/ports/authorization.service.port'
import { AUTHORIZATION_CACHE } from '@shared/authorization/domain/ports/authorization-cache.port'
import { PERMISSION_REPOSITORY } from '@shared/authorization/domain/ports/permission-repository.port'
import { AuthorizationService } from '@shared/authorization/infrastructure/authorization.service'
import { RequestScopedAuthorizationCache } from '@shared/authorization/infrastructure/cache/request-scoped-authorization.cache'
import { PermissionRepository } from '@shared/authorization/infrastructure/repositories/permission.repository'
import { type IKvStorageAdapter, KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { PAYMENT_GATEWAY_REGISTRY } from '@shared/payment-gateways'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { ConfirmWatermarkUploadCommand } from '@tenants/application/commands/confirm-watermark-upload/confirm-watermark-upload.command'
import { ConfirmWatermarkUploadHandler } from '@tenants/application/commands/confirm-watermark-upload/confirm-watermark-upload.handler'
import { UpdateMyTenantProfileCommand } from '@tenants/application/commands/update-my-tenant-profile/update-my-tenant-profile.command'
import { UpdateMyTenantProfileHandler } from '@tenants/application/commands/update-my-tenant-profile/update-my-tenant-profile.handler'
import { UpdatePayoutMethodCommand } from '@tenants/application/commands/update-payout-method/update-payout-method.command'
import { UpdatePayoutMethodHandler } from '@tenants/application/commands/update-payout-method/update-payout-method.handler'
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
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

describe('event configuration', () => {
  let module: TestingModule
  let prisma: PrismaService
  let createEvent: CreateEventHandler
  let getConfiguration: GetEventConfigurationHandler
  let updateConfiguration: UpdateEventConfigurationHandler
  let updateProfile: UpdateMyTenantProfileHandler
  let updatePayoutMethod: UpdatePayoutMethodHandler
  let confirmWatermarkUpload: ConfirmWatermarkUploadHandler
  let payoutRepo: ITenantPayoutMethodRepository
  let kv: jest.Mocked<IKvStorageAdapter>
  let storage: jest.Mocked<Pick<IStorageAdapter, 'delete'>>

  let completeTenant: { id: string }
  let incompleteTenant: { id: string }
  let tenantB: { id: string }
  let completeUser: { id: string }
  let incompleteUser: { id: string }
  let tenantBUser: { id: string }
  let eventType: { id: number }
  let bankMethod: TenantPayoutMethod
  let tenantBMethod: TenantPayoutMethod
  const createdEventIds: string[] = []

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
        { provide: PERMISSION_REPOSITORY, useClass: PermissionRepository },
        { provide: AUTHORIZATION_CACHE, useClass: RequestScopedAuthorizationCache },
        AuthorizationService,
        { provide: AUTHORIZATION_SERVICE, useExisting: AuthorizationService },
        { provide: EVENT_READ_REPOSITORY, useClass: EventReadRepository },
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
        {
          provide: LOCATION_READ_REPOSITORY,
          useValue: {
            provinceExists: async () => true,
            cantonExistsInProvince: async () => true,
          },
        },
        { provide: PAYMENT_GATEWAY_REGISTRY, useValue: { get: () => undefined } },
        {
          provide: CdnUrlBuilder,
          useValue: {
            buildPublicUrl: () => 'http://fake',
            buildWatermarkedUrl: () => 'http://fake',
            buildSecureUrl: () => 'http://fake',
            assetUrl: () => 'http://fake',
            internalUrl: () => 'http://fake',
          },
        },
        {
          provide: KV_STORAGE_ADAPTER,
          useValue: {
            write: jest.fn().mockResolvedValue(undefined),
            writeBulk: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          } satisfies IKvStorageAdapter,
        },
        {
          provide: STORAGE_ADAPTER,
          useValue: {
            delete: jest.fn().mockResolvedValue(undefined),
          } satisfies Partial<IStorageAdapter>,
        },
        EventConfigurationService,
        LocationValidator,
        CreateEventHandler,
        GetEventConfigurationHandler,
        UpdateEventConfigurationHandler,
        UpdateMyTenantProfileHandler,
        UpdatePayoutMethodHandler,
        ConfirmWatermarkUploadHandler,
      ],
    }).compile()

    prisma = module.get(PrismaService)
    createEvent = module.get(CreateEventHandler)
    getConfiguration = module.get(GetEventConfigurationHandler)
    updateConfiguration = module.get(UpdateEventConfigurationHandler)
    updateProfile = module.get(UpdateMyTenantProfileHandler)
    updatePayoutMethod = module.get(UpdatePayoutMethodHandler)
    confirmWatermarkUpload = module.get(ConfirmWatermarkUploadHandler)
    payoutRepo = module.get(TENANT_PAYOUT_METHOD_REPOSITORY)
    kv = module.get(KV_STORAGE_ADAPTER)
    storage = module.get(STORAGE_ADAPTER)

    completeTenant = await prisma.tenant.create({
      data: {
        name: 'Complete Tenant',
        is_platform: false,
        public_name: 'Complete Public',
        watermark_storage_key: 'watermarks/complete.png',
        whatsapp_number: '0991234567',
        event_quota: 10,
      },
    })
    incompleteTenant = await prisma.tenant.create({
      data: { name: 'Incomplete Tenant', is_platform: false, public_name: 'Incomplete Public' },
    })
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant B',
        is_platform: false,
        public_name: 'Tenant B Public',
        watermark_storage_key: 'watermarks/b.png',
        whatsapp_number: '0997654321',
        event_quota: 10,
      },
    })

    const tenantTpl = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'tenant' },
    })

    completeUser = await prisma.user.create({
      data: {
        email: `complete-${crypto.randomUUID()}@t.com`,
        password_hash: 'x',
        permission_template_id: tenantTpl.id,
        tenant_id: completeTenant.id,
      },
    })
    incompleteUser = await prisma.user.create({
      data: {
        email: `incomplete-${crypto.randomUUID()}@t.com`,
        password_hash: 'x',
        permission_template_id: tenantTpl.id,
        tenant_id: incompleteTenant.id,
      },
    })
    tenantBUser = await prisma.user.create({
      data: {
        email: `tenantb-${crypto.randomUUID()}@t.com`,
        password_hash: 'x',
        permission_template_id: tenantTpl.id,
        tenant_id: tenantB.id,
      },
    })

    eventType = await prisma.eventType.findFirstOrThrow()

    bankMethod = TenantPayoutMethod.createBankTransfer(
      completeTenant.id,
      {
        bankName: 'Banco Pichincha',
        accountNumber: '1234567890',
        accountType: 'savings',
        accountHolder: 'Complete Tenant',
        holderIdentification: '1710000000',
      },
      completeUser.id,
    )
    await payoutRepo.save(bankMethod)
    const payphoneMethod = TenantPayoutMethod.createPayphoneSplit(
      completeTenant.id,
      '0991234567',
      completeUser.id,
    )
    payphoneMethod.markVerified()
    await payoutRepo.save(payphoneMethod)

    tenantBMethod = TenantPayoutMethod.createBankTransfer(
      tenantB.id,
      {
        bankName: 'Banco Guayaquil',
        accountNumber: '9876543210',
        accountType: 'savings',
        accountHolder: 'Tenant B',
        holderIdentification: '0910000000',
      },
      tenantBUser.id,
    )
    await payoutRepo.save(tenantBMethod)
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.eventPayoutMethod.deleteMany({ where: { event_id: { in: createdEventIds } } })
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
      await prisma.tenantPayoutMethod.deleteMany({
        where: { tenant_id: { in: [completeTenant?.id, tenantB?.id].filter(Boolean) } },
      })
      await prisma.user.deleteMany({
        where: {
          id: { in: [completeUser?.id, incompleteUser?.id, tenantBUser?.id].filter(Boolean) },
        },
      })
      await prisma.tenant.deleteMany({
        where: {
          id: { in: [completeTenant?.id, incompleteTenant?.id, tenantB?.id].filter(Boolean) },
        },
      })
      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  it('rejects creation with an incomplete profile and names what is missing', async () => {
    const command = new CreateEventCommand(
      'Incomplete Event',
      new Date('2026-09-01'),
      new Date('2026-09-02'),
      null,
      null,
      eventType.id,
      new AuditContext(incompleteUser.id),
    )

    await expect(createEvent.execute(command)).rejects.toMatchObject({
      httpStatus: 422,
      context: { missing: expect.stringContaining('watermark') },
    })
  })

  it('does not change an existing event when the profile is edited afterwards', async () => {
    const command = new CreateEventCommand(
      'Vuelta Configurada',
      new Date('2026-09-10'),
      new Date('2026-09-12'),
      null,
      null,
      eventType.id,
      new AuditContext(completeUser.id),
    )
    const { id: eventId } = await createEvent.execute(command)
    createdEventIds.push(eventId)

    const before = await getConfiguration.execute(
      new GetEventConfigurationQuery(eventId, completeUser.id),
    )

    await updateProfile.execute(
      new UpdateMyTenantProfileCommand(completeUser.id, 'Nombre Nuevo', undefined),
    )
    await updatePayoutMethod.execute(
      new UpdatePayoutMethodCommand(
        completeUser.id,
        bankMethod.id,
        undefined,
        {
          bankName: 'Banco Pichincha',
          accountNumber: '9999999999',
          accountType: 'savings',
          accountHolder: 'Complete Tenant',
          holderIdentification: '1710000000',
        },
        undefined,
        undefined,
      ),
    )

    const after = await getConfiguration.execute(
      new GetEventConfigurationQuery(eventId, completeUser.id),
    )

    expect(after).toEqual(before)
  })

  it('leaves untouched fields frozen when a partial update follows a profile rebrand', async () => {
    const { id: eventId } = await createEvent.execute(
      new CreateEventCommand(
        'Vuelta Parcial',
        new Date('2026-10-01'),
        new Date('2026-10-02'),
        null,
        null,
        eventType.id,
        new AuditContext(completeUser.id),
      ),
    )
    createdEventIds.push(eventId)

    const before = await getConfiguration.execute(
      new GetEventConfigurationQuery(eventId, completeUser.id),
    )

    await updateProfile.execute(
      new UpdateMyTenantProfileCommand(completeUser.id, 'Andes Pro', undefined),
    )
    await confirmWatermarkUpload.execute(
      new ConfirmWatermarkUploadCommand(
        completeUser.id,
        `tenants/${completeTenant.id}/watermark/andes-pro.png`,
      ),
    )
    await updatePayoutMethod.execute(
      new UpdatePayoutMethodCommand(
        completeUser.id,
        bankMethod.id,
        undefined,
        {
          bankName: 'Banco Pichincha',
          accountNumber: '8888888888',
          accountType: 'savings',
          accountHolder: 'Complete Tenant',
          holderIdentification: '1710000000',
        },
        undefined,
        undefined,
      ),
    )

    await updateConfiguration.execute(
      new UpdateEventConfigurationCommand(eventId, completeUser.id, {
        whatsappNumber: '0977777777',
      }),
    )

    const after = await getConfiguration.execute(
      new GetEventConfigurationQuery(eventId, completeUser.id),
    )

    expect(after.whatsappNumber).toBe('0977777777')
    expect(after.publicName).toBe(before.publicName)
    expect(after.watermarkStorageKey).toBe(before.watermarkStorageKey)
    expect(after.payoutMethods).toEqual(before.payoutMethods)
  })

  it('a profile watermark replacement does not touch an existing event', async () => {
    const { id: eventId } = await createEvent.execute(
      new CreateEventCommand(
        'Vuelta Watermark Freeze',
        new Date('2026-11-05'),
        new Date('2026-11-06'),
        null,
        null,
        eventType.id,
        new AuditContext(completeUser.id),
      ),
    )
    createdEventIds.push(eventId)

    const before = await getConfiguration.execute(
      new GetEventConfigurationQuery(eventId, completeUser.id),
    )
    kv.write.mockClear()
    storage.delete.mockClear()

    await confirmWatermarkUpload.execute(
      new ConfirmWatermarkUploadCommand(
        completeUser.id,
        `tenants/${completeTenant.id}/watermark/rebrand.png`,
      ),
    )

    const after = await getConfiguration.execute(
      new GetEventConfigurationQuery(eventId, completeUser.id),
    )

    expect(after.watermarkStorageKey).toBe(before.watermarkStorageKey)
    expect(kv.write).not.toHaveBeenCalledWith(`wm-${eventId}`, expect.anything())
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('hides another tenant payout method behind notFound, never forbidden', async () => {
    const command = new CreateEventCommand(
      'Cross Tenant Attempt',
      new Date('2026-09-15'),
      new Date('2026-09-16'),
      null,
      null,
      eventType.id,
      new AuditContext(completeUser.id),
      { payoutMethods: [{ source: 'profile', id: tenantBMethod.id }] },
    )

    await expect(createEvent.execute(command)).rejects.toMatchObject({
      httpStatus: 404,
      code: 'NOT_FOUND',
    })
  })
})
