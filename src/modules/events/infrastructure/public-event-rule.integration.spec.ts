import { randomUUID } from 'node:crypto'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { Pagination } from '@shared/application'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../config/configuration'
import { validate } from '../../../config/env.validation'
import {
  isPubliclyListedEvent,
  PUBLIC_EVENT_RULE_SELECT,
  PUBLICLY_LISTED_EVENT,
} from './public-event-rule'

const fakeCdn = {
  assetUrl: () => 'https://cdn.test/asset',
  photoUrl: () => 'https://cdn.test/photo',
} as unknown as CdnUrlBuilder

const STATUSES = ['active', 'completed', 'archived', 'frozen'] as const
type Status = (typeof STATUSES)[number]

/**
 * One rule decides whether an event is public: the `where` every public query filters by and the
 * predicate used once an event is already loaded (the buyer's orders). Both are checked here
 * against every combination of status, cover and deletion, on a real Postgres.
 */
describe('public event rule', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: EventReadRepository

  const runId = `pr-${randomUUID().slice(0, 8)}`
  let tenantId: string
  let eventTypeId: number
  const events: { key: string; id: string; slug: string; public: boolean }[] = []

  const NO_FILTERS = { search: null, eventTypeIds: [], provinceIds: [], from: null, to: null }
  const byKey = (key: string) => {
    const event = events.find((item) => item.key === key)
    if (!event) throw new Error(`no event ${key}`)
    return event
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
      providers: [PrismaService],
    }).compile()

    prisma = module.get(PrismaService)
    repo = new EventReadRepository(prisma, fakeCdn)

    const tenant = await prisma.tenant.create({
      data: { name: `${runId} tenant`, is_platform: false },
    })
    tenantId = tenant.id
    const type = await prisma.eventType.create({ data: { name: `${runId} tipo` } })
    eventTypeId = type.id

    for (const status of STATUSES) {
      for (const cover of [true, false]) {
        for (const deleted of [false, true]) {
          const key = `${status}-${cover ? 'cover' : 'nocover'}-${deleted ? 'deleted' : 'live'}`
          const event = await prisma.event.create({
            data: {
              name: `${runId} ${key}`,
              slug: `${runId}-${key}`,
              start_date: new Date('2026-06-01'),
              end_date: new Date('2026-06-01'),
              tenant_id: tenantId,
              event_type_id: eventTypeId,
              status: status as Status,
              deleted_at: deleted ? new Date() : null,
            },
          })
          if (cover) {
            await prisma.eventAsset.create({
              data: {
                event_id: event.id,
                asset_type: 'cover_image',
                storage_key: `cover/${runId}/${key}`,
                public_slug: `c${randomUUID().slice(0, 20)}`,
              },
            })
          }
          // Covers are what is counted: another asset type never makes an event public.
          await prisma.eventAsset.create({
            data: {
              event_id: event.id,
              asset_type: 'event_logo',
              storage_key: `logo/${runId}/${key}`,
              public_slug: `l${randomUUID().slice(0, 20)}`,
            },
          })
          await prisma.photo.create({
            data: {
              event_id: event.id,
              filename: `${key}.jpg`,
              storage_key: `photos/${runId}/${key}`,
              public_slug: randomUUID().slice(0, 20),
              file_size: BigInt(1000),
            },
          })
          events.push({
            key,
            id: event.id,
            slug: event.slug,
            public: (status === 'active' || status === 'completed') && cover && !deleted,
          })
        }
      }
    }
  })

  afterAll(async () => {
    if (prisma) {
      const ids = events.map((event) => event.id)
      await prisma.photo.deleteMany({ where: { event_id: { in: ids } } })
      await prisma.eventAsset.deleteMany({ where: { event_id: { in: ids } } })
      await prisma.event.deleteMany({ where: { id: { in: ids } } })
      if (eventTypeId) await prisma.eventType.deleteMany({ where: { id: eventTypeId } })
      if (tenantId) await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  it('makes public exactly the active or completed events with a cover that are not deleted', async () => {
    const listed = await prisma.event.findMany({
      where: { ...PUBLICLY_LISTED_EVENT, id: { in: events.map((event) => event.id) } },
      select: { id: true },
    })
    const listedIds = new Set(listed.map((event) => event.id))

    expect(Object.fromEntries(events.map((event) => [event.key, listedIds.has(event.id)]))).toEqual(
      Object.fromEntries(events.map((event) => [event.key, event.public])),
    )
  })

  it('gives the same answer for an event already loaded as the query does', async () => {
    const rows = await prisma.event.findMany({
      where: { id: { in: events.map((event) => event.id) } },
      select: { id: true, ...PUBLIC_EVENT_RULE_SELECT },
    })

    const keyById = new Map(events.map((event) => [event.id, event.key]))

    expect(
      Object.fromEntries(rows.map((row) => [keyById.get(row.id), isPubliclyListedEvent(row)])),
    ).toEqual(Object.fromEntries(events.map((event) => [event.key, event.public])))
  })

  it('lists and counts a completed event like an active one', async () => {
    const page = await repo.getPublicEventsList(new Pagination(1, 50), {
      ...NO_FILTERS,
      search: runId,
    })
    const filters = await repo.getPublicEventFilters({ ...NO_FILTERS, search: runId })

    expect(page.items.map((item) => item.slug).sort()).toEqual(
      [byKey('active-cover-live').slug, byKey('completed-cover-live').slug].sort(),
    )
    expect(filters.eventTypes.find((type) => type.id === eventTypeId)?.count).toBe(2)
  })

  it('opens the detail of a completed event and keeps hidden ones closed', async () => {
    const detail = async (key: string) => (await repo.getPublicEventDetail(byKey(key).slug))?.slug

    expect(await detail('completed-cover-live')).toBe(byKey('completed-cover-live').slug)
    expect(await detail('active-cover-live')).toBe(byKey('active-cover-live').slug)
    expect(await detail('archived-cover-live')).toBeUndefined()
    expect(await detail('frozen-cover-live')).toBeUndefined()
    expect(await detail('completed-nocover-live')).toBeUndefined()
    expect(await detail('completed-cover-deleted')).toBeUndefined()
  })

  it('finds the gallery of every public event by its slug, and of no other', async () => {
    const found = await Promise.all(
      events.map(async (event) => [event.key, (await repo.findPublicEventBySlug(event.slug))?.id]),
    )

    expect(Object.fromEntries(found)).toEqual(
      Object.fromEntries(events.map((event) => [event.key, event.public ? event.id : undefined])),
    )
  })

  it('serves the photos of a completed event', async () => {
    const event = await repo.findPublicEventBySlug(byKey('completed-cover-live').slug)
    if (!event) throw new Error('completed event not found')

    const photos = await repo.getPublicPhotos(event.id, new Pagination(1, 10), {
      photoCategoryId: null,
      bibNumber: null,
      bibMatch: 'exact',
      section: null,
    })

    expect(photos.total).toBe(1)
  })
})
