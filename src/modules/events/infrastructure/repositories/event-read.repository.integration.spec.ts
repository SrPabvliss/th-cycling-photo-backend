import { randomUUID } from 'node:crypto'
import type { EventListProjection } from '@events/application/projections'
import { EVENT_TABS } from '@events/application/queries/get-events-list/get-events-list.dto'
import { isVisible } from '@events/domain/event-alert'
import { Prisma } from '@generated/prisma/client'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { EventReadRepository } from './event-read.repository'

const fakeCdn = {
  assetUrl: (slug: string, preset?: string) => `https://cdn.test/${slug}/${preset ?? 'raw'}`,
} as unknown as CdnUrlBuilder

describe('EventReadRepository events list SQL', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: EventReadRepository
  let orderRepo: OrderReadRepository

  const runId = `events-it-${randomUUID().slice(0, 8)}`

  const tenantIds: Record<string, string> = {}
  const eventIds: Record<string, string> = {}
  const userIds: string[] = []
  let scope: EventScope
  let provinceName: string
  let cantonName: string

  const slug = (key: string) => `${runId}-${key}`.slice(0, 30)

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
      providers: [PrismaService],
    }).compile()

    prisma = module.get(PrismaService)
    repo = new EventReadRepository(prisma, fakeCdn)
    orderRepo = new OrderReadRepository(prisma, fakeCdn)

    const eventType = await prisma.eventType.findFirstOrThrow()
    const canton = await prisma.canton.findFirstOrThrow({ include: { province: true } })
    provinceName = canton.province.name
    cantonName = canton.name

    async function createTenant(key: string) {
      const tenant = await prisma.tenant.create({
        data: { name: `${runId} ${key}`, is_platform: false },
      })
      tenantIds[key] = tenant.id
      return tenant.id
    }

    async function createEvent(
      key: string,
      tenantKey: string,
      overrides: {
        name?: string
        startDate?: Date
        cover?: boolean
        isFrozen?: boolean
        deletedAt?: Date | null
        status?: 'active' | 'archived'
        photoQuota?: number | null
        photosUploaded?: number
        located?: boolean
      } = {},
    ) {
      const startDate = overrides.startDate ?? new Date('2026-01-01')
      const event = await prisma.event.create({
        data: {
          name: overrides.name ?? `${runId} ${key}`,
          slug: `event-${runId}-${key}`,
          start_date: startDate,
          end_date: new Date(startDate.getTime() + 86_400_000),
          created_at: new Date(startDate.getTime() - 30 * 86_400_000),
          tenant_id: tenantIds[tenantKey],
          event_type_id: eventType.id,
          province_id: overrides.located ? canton.province_id : null,
          canton_id: overrides.located ? canton.id : null,
          status: overrides.status ?? 'active',
          is_frozen: overrides.isFrozen ?? false,
          frozen_at: overrides.isFrozen ? new Date() : null,
          deleted_at: overrides.deletedAt ?? null,
          photo_quota: overrides.photoQuota ?? null,
          photos_uploaded: overrides.photosUploaded ?? 0,
        },
      })
      eventIds[key] = event.id

      if (overrides.cover) {
        await prisma.eventAsset.create({
          data: {
            event_id: event.id,
            asset_type: 'cover_image',
            storage_key: `cover/${runId}/${key}`,
            public_slug: slug(`c-${key}`),
          },
        })
      }
      return event.id
    }

    async function createPhotos(
      eventKey: string,
      count: number,
      options: { reviewed?: number; uploadedAt?: Date } = {},
    ) {
      const reviewed = options.reviewed ?? 0
      await Promise.all(
        Array.from({ length: count }, (_unused, index) =>
          prisma.photo.create({
            data: {
              event_id: eventIds[eventKey],
              filename: `${eventKey}-${index}.jpg`,
              storage_key: `photos/${runId}/${eventKey}/${index}`,
              public_slug: `${randomUUID().slice(0, 12)}${index}`,
              file_size: BigInt(1000 + index),
              uploaded_at: options.uploadedAt ?? new Date('2026-02-01'),
              reviewed_at: index < reviewed ? new Date('2026-02-02') : null,
            },
          }),
        ),
      )
    }

    async function createOrder(
      eventKey: string,
      status: 'paid' | 'delivered' | 'cancelled' | 'gifted',
      subtotal: string,
    ) {
      const buyer = await prisma.user.create({
        data: {
          email: `${runId}-${randomUUID().slice(0, 8)}@example.com`,
          password_hash: 'x',
          first_name: 'Buyer',
          last_name: eventKey,
        },
      })
      userIds.push(buyer.id)
      await prisma.order.create({
        data: {
          event_id: eventIds[eventKey],
          user_id: buyer.id,
          status,
          subtotal: new Prisma.Decimal(subtotal),
        },
      })
    }

    await createTenant('a')
    await createTenant('b')

    await createEvent('conPedidos', 'a', {
      name: 'Con pedidos',
      startDate: new Date('2026-03-01'),
      cover: true,
      located: true,
      photoQuota: 1000,
      photosUploaded: 4,
    })
    await createEvent('noCover', 'a', {
      name: 'Sin portada',
      startDate: new Date('2026-02-01'),
      photoQuota: 100,
      photosUploaded: 10,
    })
    await createEvent('frozen', 'a', {
      name: 'Congelado con portada',
      startDate: new Date('2026-01-15'),
      cover: true,
      isFrozen: true,
      photoQuota: 100,
      photosUploaded: 1,
    })
    await createEvent('archived', 'a', {
      name: 'Archivado',
      startDate: new Date('2026-01-10'),
      cover: true,
      status: 'archived',
      deletedAt: new Date(),
      photoQuota: 100,
      photosUploaded: 2,
    })
    await createEvent('empty', 'a', {
      name: 'Vacio sin fotos',
      startDate: new Date('2026-01-05'),
      cover: true,
      photoQuota: 100,
      photosUploaded: 0,
    })
    await createEvent('cupoAgotado', 'a', {
      name: 'Cupo agotado',
      startDate: new Date('2026-01-04'),
      cover: true,
      photoQuota: 5,
      photosUploaded: 10,
    })
    await createEvent('sinLimite', 'a', {
      name: 'Sin limite de cupo',
      startDate: new Date('2026-01-03'),
      cover: true,
      photoQuota: null,
      photosUploaded: 900,
    })
    await createEvent('granted', 'b', {
      name: 'De otro organizador',
      startDate: new Date('2026-01-02'),
      cover: true,
      photoQuota: 100,
      photosUploaded: 3,
    })

    await createPhotos('conPedidos', 4, { reviewed: 1, uploadedAt: new Date('2026-06-01') })
    await createPhotos('cupoAgotado', 2, { reviewed: 2, uploadedAt: new Date('2026-04-01') })
    await createPhotos('frozen', 1, { reviewed: 0, uploadedAt: new Date('2026-05-01') })
    await createPhotos('noCover', 1, { reviewed: 0, uploadedAt: new Date('2026-03-01') })

    await createOrder('conPedidos', 'paid', '10.50')
    await createOrder('conPedidos', 'delivered', '5.25')
    await createOrder('conPedidos', 'cancelled', '99.00')
    await createOrder('conPedidos', 'gifted', '77.00')
    await createOrder('frozen', 'paid', '1.00')

    scope = new EventScope(false, [tenantIds.a, tenantIds.b], [])
  })

  afterAll(async () => {
    if (prisma) {
      const ids = Object.values(eventIds)
      await prisma.order.deleteMany({ where: { event_id: { in: ids } } })
      await prisma.photo.deleteMany({ where: { event_id: { in: ids } } })
      await prisma.eventAsset.deleteMany({ where: { event_id: { in: ids } } })
      await prisma.event.deleteMany({ where: { id: { in: ids } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
      await prisma.tenant.deleteMany({ where: { id: { in: Object.values(tenantIds) } } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  async function listAll(overrides: Record<string, unknown> = {}) {
    return repo.getEventsList(new Pagination(1, 100), { tab: 'all', ...overrides }, scope)
  }

  async function find(name: string): Promise<EventListProjection> {
    const page = await listAll()
    const row = page.items.find((item) => item.name === name)
    if (!row) throw new Error(`event ${name} not found`)
    return row
  }

  it('keeps a frozen event visible — freezing never hides it from buyers', async () => {
    const row = await find('Congelado con portada')
    expect(row.alert).toBe('frozen')
    expect(isVisible({ ...row, hasCover: row.coverImageSlug !== null })).toBe(true)
  })

  it('gives every tab a total equal to the rows that tab returns', async () => {
    const pages = await Promise.all(
      EVENT_TABS.map((tab) => repo.getEventsList(new Pagination(1, 100), { tab }, scope)),
    )
    expect(pages.map((page) => page.total)).toEqual(pages.map((page) => page.items.length))

    const byTab = Object.fromEntries(EVENT_TABS.map((tab, index) => [tab, pages[index].total]))
    expect(byTab.all).toBe(8)
    expect(byTab.active + byTab.archived).toBe(byTab.all)
    expect(byTab.no_cover).toBe(1)
    expect(byTab.frozen).toBe(1)
    expect(byTab.archived).toBe(1)
  })

  it('puts each tab only the rows its predicate admits', async () => {
    const [active, noCover, frozen, archived] = await Promise.all([
      repo.getEventsList(new Pagination(1, 100), { tab: 'active' }, scope),
      repo.getEventsList(new Pagination(1, 100), { tab: 'no_cover' }, scope),
      repo.getEventsList(new Pagination(1, 100), { tab: 'frozen' }, scope),
      repo.getEventsList(new Pagination(1, 100), { tab: 'archived' }, scope),
    ])

    expect(active.items.every((item) => !item.isArchived)).toBe(true)
    expect(noCover.items.map((item) => item.name)).toEqual(['Sin portada'])
    expect(frozen.items.map((item) => item.name)).toEqual(['Congelado con portada'])
    expect(archived.items.map((item) => item.name)).toEqual(['Archivado'])
    expect(archived.items[0].alert).toBe('archived')
  })

  it('reports revenue identical to GET /orders/stats for the same event', async () => {
    const fromList = (await find('Con pedidos')).revenue
    const fromOrders = await orderRepo.sumRevenue(eventIds.conPedidos, scope)
    expect(fromList).toBe(new Prisma.Decimal(fromOrders).toFixed(2))
    expect(fromList).toBe('15.75')
  })

  it('measures quota against photos_uploaded, not the live photo count', async () => {
    const row = await find('Cupo agotado')
    expect(row.photoCount).toBeLessThan(row.photosUploaded)
    expect(row.alert).toBe('quota_exhausted')
  })

  it('never treats an unlimited event as close to its quota', async () => {
    const row = await find('Sin limite de cupo')
    expect(row.photoQuota).toBeNull()
    expect(row.alert).toBe('empty')
  })

  it('scopes to one tenant for an organizador and to granted ids for an operator', async () => {
    const asOrganizer = await repo.getEventsList(
      new Pagination(1, 100),
      { tab: 'all' },
      new EventScope(false, [tenantIds.a], []),
    )
    expect(asOrganizer.items.every((e) => e.organizerId === tenantIds.a)).toBe(true)
    expect(asOrganizer.total).toBe(7)

    const asOperator = await repo.getEventsList(
      new Pagination(1, 100),
      { tab: 'all' },
      new EventScope(false, [], [eventIds.granted]),
    )
    expect(asOperator.items.map((e) => e.id)).toEqual([eventIds.granted])
  })

  it('returns nothing for an empty scope', async () => {
    const page = await repo.getEventsList(
      new Pagination(1, 100),
      { tab: 'all' },
      EventScope.empty(),
    )
    expect(page.items).toEqual([])
    expect(page.total).toBe(0)
  })

  it('filters by organizador', async () => {
    const page = await listAll({ organizerId: tenantIds.b })
    expect(page.items.map((e) => e.name)).toEqual(['De otro organizador'])
  })

  it('widens search to the province and canton names, not only the event name', async () => {
    const byName = await listAll({ search: 'Con pedidos' })
    expect(byName.items.map((e) => e.name)).toEqual(['Con pedidos'])

    const byProvince = await listAll({ search: provinceName })
    expect(byProvince.items.map((e) => e.name)).toEqual(['Con pedidos'])

    const byCanton = await listAll({ search: cantonName })
    expect(byCanton.items.map((e) => e.name)).toEqual(['Con pedidos'])
  })

  it('treats LIKE metacharacters in the search term as literals', async () => {
    const page = await listAll({ search: '%' })
    expect(page.items).toEqual([])
  })

  it('sorts by event date descending by default', async () => {
    const page = await listAll()
    const dates = page.items.map((e) => e.startDate.getTime())
    expect(dates).toEqual([...dates].sort((a, b) => b - a))
  })

  it('sorts by name ascending', async () => {
    const page = await listAll({ sort: 'name' })
    const names = page.items.map((e) => e.name)
    expect(names[0]).toBe('Archivado')
    expect(names[names.length - 1]).toBe('Vacio sin fotos')
    expect(names.indexOf('Cupo agotado')).toBeLessThan(names.indexOf('De otro organizador'))
  })

  it('sorts by quota fill and pushes the unlimited event last', async () => {
    const page = await listAll({ sort: 'quota' })
    const names = page.items.map((e) => e.name)
    expect(names.indexOf('Cupo agotado')).toBeLessThan(names.indexOf('Con pedidos'))
    expect(names[names.length - 1]).toBe('Sin limite de cupo')
  })

  it('sorts by most recent upload, falling back to created_at', async () => {
    const page = await listAll({ sort: 'activity' })
    const names = page.items.map((e) => e.name)
    expect(names[0]).toBe('Con pedidos')
    expect(names.indexOf('Congelado con portada')).toBeLessThan(names.indexOf('Cupo agotado'))
  })

  it('sorts by photos still awaiting review', async () => {
    const page = await listAll({ sort: 'pending_review' })
    const names = page.items.map((e) => e.name)
    expect(names[0]).toBe('Con pedidos')
    expect(names.indexOf('Congelado con portada')).toBeLessThan(names.indexOf('Cupo agotado'))
  })

  it('sorts by revenue over paid and delivered orders', async () => {
    const page = await listAll({ sort: 'revenue' })
    const names = page.items.map((e) => e.name)
    expect(names[0]).toBe('Con pedidos')
    expect(names[1]).toBe('Congelado con portada')
  })

  it('paginates without dropping or repeating an event', async () => {
    const [first, second, third] = await Promise.all([
      repo.getEventsList(new Pagination(1, 3), { tab: 'all', sort: 'quota' }, scope),
      repo.getEventsList(new Pagination(2, 3), { tab: 'all', sort: 'quota' }, scope),
      repo.getEventsList(new Pagination(3, 3), { tab: 'all', sort: 'quota' }, scope),
    ])
    const ids = [...first.items, ...second.items, ...third.items].map((e) => e.id)
    expect(new Set(ids).size).toBe(8)
    expect(first.total).toBe(8)
  })

  it('still reports the total on a page past the last row', async () => {
    const page = await repo.getEventsList(new Pagination(50, 10), { tab: 'all' }, scope)
    expect(page.items).toEqual([])
    expect(page.total).toBe(8)
  })

  it('carries the per-event aggregates the row needs', async () => {
    const row = await find('Con pedidos')
    expect(row.organizerId).toBe(tenantIds.a)
    expect(row.organizerName).toBe(`${runId} a`)
    expect(row.photoCount).toBe(4)
    expect(row.reviewedCount).toBe(1)
    expect(row.paidCount).toBe(1)
    expect(row.deliveredCount).toBe(1)
    expect(row.cancelledCount).toBe(1)
    expect(row.giftedCount).toBe(1)
    expect(row.lastUploadAt).not.toBeNull()
    expect(row.alert).toBeNull()
  })

  it('flags an event with no cover before anything else that is not archival', async () => {
    const row = await find('Sin portada')
    expect(row.alert).toBe('no_cover')
    expect(isVisible({ ...row, hasCover: row.coverImageSlug !== null })).toBe(false)
  })

  it('flags an event with a cover and no photos as empty', async () => {
    const row = await find('Vacio sin fotos')
    expect(row.alert).toBe('empty')
    expect(row.photoCount).toBe(0)
  })

  describe('getEventsStats', () => {
    it("gives every tab's count the same total as the rows that tab returns", async () => {
      const stats = await repo.getEventsStats({}, scope)
      const counted = await Promise.all(
        EVENT_TABS.map((tab) => repo.getEventsList(new Pagination(1, 100), { tab }, scope)),
      )
      expect(counted.map((p) => p.total)).toEqual(EVENT_TABS.map((t) => stats.tabs[t]))
    })

    it('does not move the tiles when a tab is applied — the tabs partition the same population', async () => {
      const withoutTab = await repo.getEventsStats({}, scope)
      const perTab = await Promise.all(EVENT_TABS.map((tab) => repo.getEventsStats({ tab }, scope)))
      perTab.forEach((stats) => {
        expect(stats).toEqual(withoutTab)
      })
    })

    it('reports totals matching the fixture set', async () => {
      const stats = await repo.getEventsStats({}, scope)

      expect(stats.totalEvents).toBe(8)
      expect(stats.activeEvents).toBe(7)
      expect(stats.visibleEvents).toBe(6)
      expect(stats.tabs).toEqual({
        all: 8,
        active: 7,
        no_cover: 1,
        frozen: 1,
        archived: 1,
      })
    })

    it('keeps a frozen event with a cover counted as visible — freezing never hides it from buyers', async () => {
      const activeOnly = await repo.getEventsStats({ search: 'Congelado con portada' }, scope)
      expect(activeOnly.visibleEvents).toBe(1)
      expect(activeOnly.activeEvents).toBe(1)
    })

    it('counts photos and pending review across the scoped events, not the whole table', async () => {
      const stats = await repo.getEventsStats({}, scope)

      expect(stats.photosOnline).toBe(8)
      expect(stats.pendingReview).toBe(5)
      expect(stats.eventsPendingReview).toBe(3)
    })

    it('counts an exhausted quota as near-or-over, and never counts an unlimited quota', async () => {
      const stats = await repo.getEventsStats({}, scope)
      expect(stats.nearOrOverQuota).toBe(1)

      const onlyUnlimited = await repo.getEventsStats({ search: 'Sin limite de cupo' }, scope)
      expect(onlyUnlimited.nearOrOverQuota).toBe(0)
    })

    it('sums revenue over paid and delivered only, matching the per-event figure', async () => {
      const stats = await repo.getEventsStats({}, scope)
      expect(stats.revenue).toBe('16.75')
      expect(stats.orders).toBe(5)
      expect(stats.unpaidOrders).toBe(0)
    })

    it('honours organizerId, scoping every figure to that organizador only', async () => {
      const stats = await repo.getEventsStats({ organizerId: tenantIds.b }, scope)
      expect(stats.totalEvents).toBe(1)
      expect(stats.tabs.all).toBe(1)
      expect(stats.revenue).toBe('0.00')
    })

    it('honours search the same way the list query does', async () => {
      const stats = await repo.getEventsStats({ search: 'Con pedidos' }, scope)
      expect(stats.totalEvents).toBe(1)
      expect(stats.revenue).toBe('15.75')
    })

    it('returns zeroed figures for an empty scope', async () => {
      const stats = await repo.getEventsStats({}, EventScope.empty())
      expect(stats.totalEvents).toBe(0)
      expect(stats.revenue).toBe('0.00')
      expect(stats.tabs).toEqual({
        all: 0,
        active: 0,
        no_cover: 0,
        frozen: 0,
        archived: 0,
      })
    })
  })
})
