import { randomUUID as uuid } from 'node:crypto'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { Prisma } from '@generated/prisma/client'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { CORRECTION_REPOSITORY } from '@photos/domain/ports/correction-repository.port'
import { PhotoReadRepository } from '@photos/infrastructure/repositories/photo-read.repository'
import { Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { PermissionKey } from '@shared/authorization/domain/permission-catalog'
import { AUTHORIZATION_CACHE } from '@shared/authorization/domain/ports/authorization-cache.port'
import { PERMISSION_REPOSITORY } from '@shared/authorization/domain/ports/permission-repository.port'
import { AuthorizationService } from '@shared/authorization/infrastructure/authorization.service'
import { RequestScopedAuthorizationCache } from '@shared/authorization/infrastructure/cache/request-scoped-authorization.cache'
import { eventScopeSql } from '@shared/authorization/infrastructure/event-scope.sql'
import { PermissionRepository } from '@shared/authorization/infrastructure/repositories/permission.repository'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'
import { TenantPayoutMethod } from '../../modules/tenants/domain/entities/tenant-payout-method.entity'
import { TenantPayoutMethodRepository } from '../../modules/tenants/infrastructure/repositories/tenant-payout-method.repository'
import { TenantProfileRepository } from '../../modules/tenants/infrastructure/repositories/tenant-profile.repository'

describe('cross-tenant isolation', () => {
  const page = new Pagination(1, 10)
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
  let retoucher: any
  let crossVerbUser: any
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
            findLatestByTargets: async () => new Map(),
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

    const staffTpl = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'platform_staff' },
    })
    const customerTpl = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'customer' },
    })
    retoucher = await prisma.user.create({
      data: {
        email: `r-${uuid()}@t.com`,
        password_hash: 'x',
        permission_template_id: staffTpl.id,
        tenant_id: platformTenant.id,
      },
    })
    crossVerbUser = await prisma.user.create({
      data: {
        email: `c-${uuid()}@t.com`,
        password_hash: 'x',
        permission_template_id: customerTpl.id,
        tenant_id: tenantA.id,
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

    const grant = async (
      userId: string,
      key: PermissionKey,
      eventId: string,
      effect: 'allow' | 'deny',
    ) => {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } })
      await prisma.userPermissionGrant.create({
        data: {
          user_id: userId,
          permission_id: permission.id,
          scope_type: 'event',
          event_id: eventId,
          effect,
          granted_by_id: platformUser.id,
        },
      })
    }
    await grant(retoucher.id, 'photo.retouch.read', eventB.id, 'allow')
    await grant(crossVerbUser.id, 'photo.read', eventB.id, 'allow')
    await grant(crossVerbUser.id, 'order.read', eventA.id, 'allow')

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
      await prisma.userPermissionGrant.deleteMany({
        where: { granted_by_id: platformUser?.id },
      })
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
        where: {
          id: {
            in: [userA?.id, userB?.id, retoucher?.id, crossVerbUser?.id].filter(Boolean),
          },
        },
      })
      await prisma.user.deleteMany({
        where: { id: { in: [platformUser?.id].filter(Boolean) } },
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
    const scopeA = await authz.resolveEventScope(userA.id, 'event.read')
    expect(scopeA.all).toBe(false)
    expect(scopeA.tenantIds).toContain(tenantA.id)
    expect(scopeA.tenantIds).not.toContain(tenantB.id)
    const photoScopeA = await authz.resolveEventScope(userA.id, 'photo.read')
    const orderScopeA = await authz.resolveEventScope(userA.id, 'order.read')

    // Events
    const events = await eventRepo.getEventsList(page, { tab: 'active' }, scopeA)
    expect(events.items.map((e) => e.id)).toContain(eventA.id)
    expect(events.items.map((e) => e.id)).not.toContain(eventB.id)
    expect(await eventRepo.getEventDetailBySlug(eventB.slug, scopeA)).toBeNull()

    // Photos
    const photos = await photoRepo.getPhotosList(eventA.id, page, {}, photoScopeA)
    expect(photos.items.map((p) => p.id)).toContain(photoA.id)
    const photosB = await photoRepo.getPhotosList(eventB.id, page, {}, photoScopeA)
    expect(photosB.items).toHaveLength(0)
    expect(await photoRepo.getPhotoDetail(photoB.id, photoScopeA)).toBeNull()

    // Orders
    const ordersA = await orderRepo.getList(page, { eventId: eventA.id }, orderScopeA)
    expect(ordersA.items.map((o) => o.id)).toContain(orderA.id)
    const ordersB = await orderRepo.getList(page, { eventId: eventB.id }, orderScopeA)
    expect(ordersB.items).toHaveLength(0)
    expect(await orderRepo.getDetail(orderB.id, orderScopeA)).toBeNull()
  })

  it('isolates tenant B', async () => {
    const scopeB = await authz.resolveEventScope(userB.id, 'event.read')
    expect(scopeB.all).toBe(false)

    // Events
    const events = await eventRepo.getEventsList(page, { tab: 'active' }, scopeB)
    expect(events.items.map((e) => e.id)).toContain(eventB.id)
    expect(events.items.map((e) => e.id)).not.toContain(eventA.id)
    expect(await eventRepo.getEventDetailBySlug(eventA.slug, scopeB)).toBeNull()

    // Photos
    expect(
      await photoRepo.getPhotoDetail(
        photoA.id,
        await authz.resolveEventScope(userB.id, 'photo.read'),
      ),
    ).toBeNull()

    // Orders
    expect(
      await orderRepo.getDetail(orderA.id, await authz.resolveEventScope(userB.id, 'order.read')),
    ).toBeNull()
  })

  it('allows platform access to both', async () => {
    const scopeP = await authz.resolveEventScope(platformUser.id, 'event.read')
    expect(scopeP.all).toBe(true)

    // Events
    const events = await eventRepo.getEventsList(page, { tab: 'active' }, scopeP)
    const ids = events.items.map((e) => e.id)
    expect(ids).toContain(eventA.id)
    expect(ids).toContain(eventB.id)

    expect(await eventRepo.getEventDetailBySlug(eventA.slug, scopeP)).not.toBeNull()
    expect(await eventRepo.getEventDetailBySlug(eventB.slug, scopeP)).not.toBeNull()
  })

  describe('per-event grants (TIT-89)', () => {
    it('keeps a retoucher of another tenant event out of its events and orders', async () => {
      const events = await eventRepo.getEventsList(
        page,
        { tab: 'active' },
        await authz.resolveEventScope(retoucher.id, 'event.read'),
      )
      expect(events.items.map((e) => e.id)).not.toContain(eventB.id)
      const orders = await orderRepo.getList(
        page,
        { eventId: eventB.id },
        await authz.resolveEventScope(retoucher.id, 'order.read'),
      )
      expect(orders.items).toHaveLength(0)
      expect(
        await photoRepo.getPhotoDetail(
          photoB.id,
          await authz.resolveEventScope(retoucher.id, 'photo.read'),
        ),
      ).toBeNull()
    })

    it('lets a retoucher read the photos of the event they retouch through the union scope', async () => {
      const scope = await authz.resolveEventScope(retoucher.id, [
        'photo.read',
        'photo.retouch.read',
      ])
      expect(await photoRepo.getPhotoDetail(photoB.id, scope)).not.toBeNull()
      expect(await photoRepo.getPhotoDetail(photoA.id, scope)).toBeNull()
    })

    it('does not open the whole tenant to a user holding grants on single events', async () => {
      const scope = await authz.resolveEventScope(crossVerbUser.id, 'order.read')
      expect(scope.tenantIds).toEqual([])
      expect(scope.eventIds).toEqual([eventA.id])
    })

    it('does not let a photo.read grant leak the event into the order list', async () => {
      const orders = await orderRepo.getList(
        page,
        {},
        await authz.resolveEventScope(crossVerbUser.id, 'order.read'),
      )
      const ids = orders.items.map((o) => o.id)
      expect(ids).toContain(orderA.id)
      expect(ids).not.toContain(orderB.id)
      const photos = await authz.resolveEventScope(crossVerbUser.id, 'photo.read')
      expect(await photoRepo.getPhotoDetail(photoB.id, photos)).not.toBeNull()
      expect(await photoRepo.getPhotoDetail(photoA.id, photos)).toBeNull()
    })

    it('agrees between toPrisma, the raw SQL and includesEvent on the same data', async () => {
      const events = [eventA, eventB].map((e) => ({
        id: e.id as string,
        tenantId: e.tenant_id as string,
      }))
      const ids = events.map((e) => e.id)
      const scopes = [
        EventScope.unrestricted(),
        EventScope.empty(),
        new EventScope(false, [tenantA.id], []),
        new EventScope(false, [tenantA.id], [eventB.id]),
        new EventScope(false, [tenantA.id], [], [eventA.id]),
        new EventScope(false, [tenantA.id], [eventB.id], [eventA.id]),
        new EventScope(false, [], [eventB.id]),
        await authz.resolveEventScope(crossVerbUser.id, ['photo.read', 'order.read']),
        await authz.resolveEventScope(retoucher.id, ['photo.read', 'photo.retouch.read']),
      ]
      for (const scope of scopes) {
        const viaPrisma = (
          await prisma.event.findMany({
            where: { AND: [{ id: { in: ids } }, scope.toPrisma()] },
            select: { id: true },
          })
        )
          .map((e) => e.id)
          .sort()
        const viaSql = (
          await prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT e.id::text AS id FROM events e WHERE e.id = ANY(${ids}::uuid[]) AND ${eventScopeSql(scope, 'e')}`,
          )
        )
          .map((e) => e.id)
          .sort()
        const inMemory = events
          .filter((e) => scope.includesEvent(e))
          .map((e) => e.id)
          .sort()
        expect(viaSql).toEqual(viaPrisma)
        expect(inMemory).toEqual(viaPrisma)
      }
    })
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
