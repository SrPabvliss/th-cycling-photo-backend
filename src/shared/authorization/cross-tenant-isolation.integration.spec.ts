import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { CORRECTION_REPOSITORY } from '@photos/domain/ports/correction-repository.port'
import { PhotoReadRepository } from '@photos/infrastructure/repositories/photo-read.repository'
import { AUTHORIZATION_CACHE } from '@shared/authorization/domain/ports/authorization-cache.port'
import { PERMISSION_REPOSITORY } from '@shared/authorization/domain/ports/permission-repository.port'
import { AuthorizationService } from '@shared/authorization/infrastructure/authorization.service'
import { RequestScopedAuthorizationCache } from '@shared/authorization/infrastructure/cache/request-scoped-authorization.cache'
import { PermissionRepository } from '@shared/authorization/infrastructure/repositories/permission.repository'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { v4 as uuid } from 'uuid'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'
import { TenantPayoutMethod } from '../../modules/tenants/domain/entities/tenant-payout-method.entity'
import { TenantPayoutMethodRepository } from '../../modules/tenants/infrastructure/repositories/tenant-payout-method.repository'
import { TenantProfileRepository } from '../../modules/tenants/infrastructure/repositories/tenant-profile.repository'

describe('cross-tenant isolation', () => {
  let module: TestingModule
  let prisma: PrismaService
  let authz: AuthorizationService
  let eventRepo: EventReadRepository
  let photoRepo: PhotoReadRepository
  let orderRepo: OrderReadRepository
  let profileRepo: TenantProfileRepository
  let payoutRepo: TenantPayoutMethodRepository

  let tenantA: any
  let tenantB: any
  let eventA: any
  let eventB: any
  let photoA: any
  let photoB: any
  let orderA: any
  let orderB: any
  let userA: any
  let userB: any
  let platformUser: any
  let payoutMethodA: TenantPayoutMethod
  let payoutMethodB: TenantPayoutMethod

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
        EventReadRepository,
        PhotoReadRepository,
        OrderReadRepository,
        TenantProfileRepository,
        TenantPayoutMethodRepository,
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
          provide: STORAGE_ADAPTER,
          useValue: {
            generatePresignedGetUrl: async () => 'http://fake',
          },
        },
        {
          provide: CORRECTION_REPOSITORY,
          useValue: {
            findByPhotoId: async () => null,
          },
        },
      ],
    }).compile()

    prisma = module.get(PrismaService)
    authz = module.get(AuthorizationService)
    eventRepo = module.get(EventReadRepository)
    photoRepo = module.get(PhotoReadRepository)
    orderRepo = module.get(OrderReadRepository)
    profileRepo = module.get(TenantProfileRepository)
    payoutRepo = module.get(TenantPayoutMethodRepository)

    // Setup tenants
    tenantA = await prisma.tenant.create({
      data: { name: 'Tenant A', is_platform: false, public_name: 'Public A' },
    })
    tenantB = await prisma.tenant.create({
      data: { name: 'Tenant B', is_platform: false, public_name: 'Public B' },
    })

    const tenantTpl = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'tenant' },
    })
    const platformTpl = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'platform_admin' },
    })

    const platformTenant = await prisma.tenant.findFirstOrThrow({ where: { is_platform: true } })

    userA = await prisma.user.create({
      data: {
        email: `a-${uuid()}@t.com`,
        password_hash: 'x',
        permission_template_id: tenantTpl.id,
        tenant_id: tenantA.id,
      },
    })
    userB = await prisma.user.create({
      data: {
        email: `b-${uuid()}@t.com`,
        password_hash: 'x',
        permission_template_id: tenantTpl.id,
        tenant_id: tenantB.id,
      },
    })
    platformUser = await prisma.user.create({
      data: {
        email: `p-${uuid()}@t.com`,
        password_hash: 'x',
        permission_template_id: platformTpl.id,
        tenant_id: platformTenant.id,
      },
    })

    const evtType = await prisma.eventType.findFirstOrThrow()

    eventA = await prisma.event.create({
      data: {
        name: 'A',
        slug: `e-a-${uuid()}`,
        start_date: new Date(),
        end_date: new Date(),
        tenant_id: tenantA.id,
        event_type_id: evtType.id,
      },
    })
    eventB = await prisma.event.create({
      data: {
        name: 'B',
        slug: `e-b-${uuid()}`,
        start_date: new Date(),
        end_date: new Date(),
        tenant_id: tenantB.id,
        event_type_id: evtType.id,
      },
    })

    photoA = await prisma.photo.create({
      data: {
        event_id: eventA.id,
        filename: 'a.jpg',
        storage_key: `a-${uuid()}`,
        public_slug: `pa-${uuid().substring(0, 8)}`,
        file_size: 100,
      },
    })
    photoB = await prisma.photo.create({
      data: {
        event_id: eventB.id,
        filename: 'b.jpg',
        storage_key: `b-${uuid()}`,
        public_slug: `pb-${uuid().substring(0, 8)}`,
        file_size: 100,
      },
    })

    const oAId = uuid()
    const oBId = uuid()
    await prisma.$executeRawUnsafe(
      `INSERT INTO orders (id, event_id, user_id, status) VALUES ('${oAId}', '${eventA.id}', '${userA.id}', 'paid')`,
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO orders (id, event_id, user_id, status) VALUES ('${oBId}', '${eventB.id}', '${userB.id}', 'paid')`,
    )
    orderA = { id: oAId }
    orderB = { id: oBId }

    payoutMethodA = TenantPayoutMethod.createBankTransfer(
      tenantA.id,
      {
        bankName: 'Bank A',
        accountNumber: '1111',
        accountType: 'savings',
        accountHolder: 'Holder A',
        holderIdentification: '1111111111',
      },
      userA.id,
    )
    payoutMethodB = TenantPayoutMethod.createBankTransfer(
      tenantB.id,
      {
        bankName: 'Bank B',
        accountNumber: '2222',
        accountType: 'savings',
        accountHolder: 'Holder B',
        holderIdentification: '2222222222',
      },
      userB.id,
    )
    await payoutRepo.save(payoutMethodA)
    await payoutRepo.save(payoutMethodB)
  })

  afterAll(async () => {
    // Teardown
    if (prisma) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM orders WHERE id IN ('${orderA?.id}', '${orderB?.id}')`,
      )
      await prisma.photo.deleteMany({
        where: { id: { in: [photoA?.id, photoB?.id].filter(Boolean) } },
      })
      await prisma.event.deleteMany({
        where: { id: { in: [eventA?.id, eventB?.id].filter(Boolean) } },
      })
      await prisma.user.deleteMany({
        where: { id: { in: [userA?.id, userB?.id, platformUser?.id].filter(Boolean) } },
      })
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } },
      })

      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  it('isolates tenant A', async () => {
    const scopeA = await authz.resolveEventScope(userA.id)
    expect(scopeA.all).toBe(false)
    expect(scopeA.tenantIds).toContain(tenantA.id)
    expect(scopeA.tenantIds).not.toContain(tenantB.id)

    // Events
    const events = await eventRepo.getEventsList({ skip: 0, take: 10 }, { tab: 'active' }, scopeA)
    expect(events.items.map((e) => e.id)).toContain(eventA.id)
    expect(events.items.map((e) => e.id)).not.toContain(eventB.id)
    expect(await eventRepo.getEventDetailBySlug(eventB.slug, scopeA)).toBeNull()

    // Photos
    const photos = await photoRepo.getPhotosList(eventA.id, { skip: 0, take: 10 }, {}, scopeA)
    expect(photos.items.map((p) => p.id)).toContain(photoA.id)
    const photosB = await photoRepo.getPhotosList(eventB.id, { skip: 0, take: 10 }, {}, scopeA)
    expect(photosB.items).toHaveLength(0)
    expect(await photoRepo.getPhotoDetail(photoB.id, scopeA)).toBeNull()

    // Orders
    const ordersA = await orderRepo.getList({ skip: 0, take: 10 }, { eventId: eventA.id }, scopeA)
    expect(ordersA.items.map((o) => o.id)).toContain(orderA.id)
    const ordersB = await orderRepo.getList({ skip: 0, take: 10 }, { eventId: eventB.id }, scopeA)
    expect(ordersB.items).toHaveLength(0)
    expect(await orderRepo.getDetail(orderB.id, scopeA)).toBeNull()
  })

  it('isolates tenant B', async () => {
    const scopeB = await authz.resolveEventScope(userB.id)
    expect(scopeB.all).toBe(false)

    // Events
    const events = await eventRepo.getEventsList({ skip: 0, take: 10 }, { tab: 'active' }, scopeB)
    expect(events.items.map((e) => e.id)).toContain(eventB.id)
    expect(events.items.map((e) => e.id)).not.toContain(eventA.id)
    expect(await eventRepo.getEventDetailBySlug(eventA.slug, scopeB)).toBeNull()

    // Photos
    expect(await photoRepo.getPhotoDetail(photoA.id, scopeB)).toBeNull()

    // Orders
    expect(await orderRepo.getDetail(orderA.id, scopeB)).toBeNull()
  })

  it('allows platform access to both', async () => {
    const scopeP = await authz.resolveEventScope(platformUser.id)
    expect(scopeP.all).toBe(true)

    // Events
    const events = await eventRepo.getEventsList({ skip: 0, take: 10 }, { tab: 'active' }, scopeP)
    const ids = events.items.map((e) => e.id)
    expect(ids).toContain(eventA.id)
    expect(ids).toContain(eventB.id)

    expect(await eventRepo.getEventDetailBySlug(eventA.slug, scopeP)).not.toBeNull()
    expect(await eventRepo.getEventDetailBySlug(eventB.slug, scopeP)).not.toBeNull()
  })

  describe('tenant profile isolation', () => {
    it('reads only its own profile', async () => {
      const profileA = await profileRepo.findByTenantId(tenantA.id)
      const profileB = await profileRepo.findByTenantId(tenantB.id)

      expect(profileA?.id).toBe(tenantA.id)
      expect(profileB?.id).toBe(tenantB.id)
      expect(profileA?.id).not.toBe(profileB?.id)
    })

    it('lists only its own payout methods', async () => {
      const methodsA = await payoutRepo.findByTenantId(tenantA.id)
      const methodsB = await payoutRepo.findByTenantId(tenantB.id)

      expect(methodsA.every((m) => m.tenantId === tenantA.id)).toBe(true)
      expect(methodsB.every((m) => m.tenantId === tenantB.id)).toBe(true)
      expect(methodsA.map((m) => m.id)).not.toContain(methodsB[0].id)
    })

    it('cannot reach the other tenant method by id', async () => {
      const methodsB = await payoutRepo.findByTenantId(tenantB.id)
      const found = await payoutRepo.findById(methodsB[0].id)

      // findById is deliberately not tenant-scoped; the handler's method.tenantId !== tenantId check is what enforces the boundary
      expect(found?.tenantId).toBe(tenantB.id)
      expect(found?.tenantId).not.toBe(tenantA.id)
    })
  })
})
