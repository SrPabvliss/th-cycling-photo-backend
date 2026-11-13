import { randomUUID } from 'node:crypto'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { Pagination } from '@shared/application'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../../config/configuration'
import { validate } from '../../../../../config/env.validation'
import type { PublicEventListFilters } from './get-public-events-list.dto'

const fakeCdn = { assetUrl: () => 'https://cdn.test/asset' } as unknown as CdnUrlBuilder

describe('public events list: search and filters', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: EventReadRepository

  const runId = `pf-${randomUUID().slice(0, 8)}`

  let tenantId: string
  let provinceId: number
  let cantonId: number
  const typeIds: Record<string, number> = {}
  const eventIds: Record<string, string> = {}

  const NO_FILTERS: PublicEventListFilters = { search: null, eventTypeId: null, hasPhotos: false }

  async function list(filters: Partial<PublicEventListFilters> = {}, pagination?: Pagination) {
    return repo.getPublicEventsList(pagination ?? new Pagination(1, 50), {
      ...NO_FILTERS,
      ...filters,
    })
  }

  async function namesFor(filters: Partial<PublicEventListFilters>) {
    const page = await list(filters)
    return page.items.map((item) => item.name)
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

    const country = await prisma.country.findFirstOrThrow()
    const province = await prisma.province.create({
      data: {
        name: `Tungurahúa ${runId}`,
        code: runId.slice(0, 10),
        country_id: country.id,
      },
    })
    provinceId = province.id
    const canton = await prisma.canton.create({
      data: { name: `Cañar ${runId}`, province_id: province.id },
    })
    cantonId = canton.id

    const tenant = await prisma.tenant.create({
      data: { name: `${runId} tenant`, is_platform: false },
    })
    tenantId = tenant.id

    for (const key of ['Ciclismo', 'Trail', 'SinEventos', 'SoloOcultos']) {
      const type = await prisma.eventType.create({ data: { name: `${runId} ${key}` } })
      typeIds[key] = type.id
    }

    async function createEvent(
      key: string,
      data: {
        name: string
        type: string
        startDate: string
        located?: boolean
        cover?: boolean
        archived?: boolean
        photos?: number
      },
    ) {
      const startDate = new Date(data.startDate)
      const event = await prisma.event.create({
        data: {
          name: data.name,
          slug: `event-${runId}-${key}`,
          start_date: startDate,
          end_date: startDate,
          tenant_id: tenantId,
          event_type_id: typeIds[data.type],
          province_id: data.located ? provinceId : null,
          canton_id: data.located ? cantonId : null,
          status: data.archived ? 'archived' : 'active',
          deleted_at: data.archived ? new Date() : null,
        },
      })
      eventIds[key] = event.id

      if (data.cover !== false) {
        await prisma.eventAsset.create({
          data: {
            event_id: event.id,
            asset_type: 'cover_image',
            storage_key: `cover/${runId}/${key}`,
            public_slug: `${runId}-c-${key}`.slice(0, 30),
          },
        })
      }

      for (let index = 0; index < (data.photos ?? 0); index++) {
        await prisma.photo.create({
          data: {
            event_id: event.id,
            filename: `${key}-${index}.jpg`,
            storage_key: `photos/${runId}/${key}/${index}`,
            public_slug: `${randomUUID().slice(0, 12)}${index}`,
            file_size: BigInt(1000),
          },
        })
      }
    }

    await createEvent('chimborazo', {
      name: `Vuelta al Chimborazó ${runId}`,
      type: 'Ciclismo',
      startDate: '2026-03-01',
      located: true,
      photos: 2,
    })
    await createEvent('trail', {
      name: `Trail 100%_real ${runId}`,
      type: 'Trail',
      startDate: '2026-02-01',
    })
    await createEvent('ruta', {
      name: `Ruta sin acento ${runId}`,
      type: 'Ciclismo',
      startDate: '2026-01-01',
    })
    await createEvent('sinPortada', {
      name: `Sin portada ${runId}`,
      type: 'SoloOcultos',
      startDate: '2026-04-01',
      cover: false,
      photos: 1,
    })
    await createEvent('archivado', {
      name: `Archivado ${runId}`,
      type: 'SoloOcultos',
      startDate: '2026-05-01',
      archived: true,
      photos: 1,
    })
  })

  afterAll(async () => {
    if (prisma) {
      const ids = Object.values(eventIds)
      await prisma.photo.deleteMany({ where: { event_id: { in: ids } } })
      await prisma.eventAsset.deleteMany({ where: { event_id: { in: ids } } })
      await prisma.event.deleteMany({ where: { id: { in: ids } } })
      await prisma.eventType.deleteMany({ where: { id: { in: Object.values(typeIds) } } })
      if (tenantId) await prisma.tenant.deleteMany({ where: { id: tenantId } })
      if (cantonId) await prisma.canton.deleteMany({ where: { id: cantonId } })
      if (provinceId) await prisma.province.deleteMany({ where: { id: provinceId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  const CHIMBORAZO = () => `Vuelta al Chimborazó ${runId}`
  const TRAIL = () => `Trail 100%_real ${runId}`
  const RUTA = () => `Ruta sin acento ${runId}`

  it('without filters lists only visible events, newest first, each with its event type', async () => {
    const page = await list()
    const mine = page.items.filter((item) => item.name.endsWith(runId))

    expect(mine.map((item) => item.name)).toEqual([CHIMBORAZO(), TRAIL(), RUTA()])
    expect(mine[0]).toMatchObject({
      eventTypeId: typeIds.Ciclismo,
      eventTypeName: `${runId} Ciclismo`,
      photoCount: 2,
      provinceName: `Tungurahúa ${runId}`,
      cantonName: `Cañar ${runId}`,
    })
    expect(mine[1]).toMatchObject({ eventTypeId: typeIds.Trail, photoCount: 0 })
  })

  it('searches the event name by a partial, case-insensitive match', async () => {
    expect(await namesFor({ search: `SIN ACENTO ${runId}` })).toEqual([RUTA()])
  })

  it('ignores accents in the event name', async () => {
    expect(await namesFor({ search: `chimborazo ${runId}` })).toEqual([CHIMBORAZO()])
  })

  it('ignores accents in the search term itself', async () => {
    expect(await namesFor({ search: `sín acentó ${runId}` })).toEqual([RUTA()])
  })

  it('searches the canton name, ñ included', async () => {
    expect(await namesFor({ search: `canar ${runId}` })).toEqual([CHIMBORAZO()])
  })

  it('searches the province name', async () => {
    expect(await namesFor({ search: `tungurahua ${runId}` })).toEqual([CHIMBORAZO()])
  })

  it('treats % and _ typed by the user as literal text', async () => {
    expect(await namesFor({ search: `100%_real ${runId}` })).toEqual([TRAIL()])
    expect(await namesFor({ search: `Ruta%${runId}` })).toEqual([])
    expect(await namesFor({ search: `Ruta_sin acento ${runId}` })).toEqual([])
  })

  it('never surfaces a hidden event through search', async () => {
    expect(await namesFor({ search: `portada ${runId}` })).toEqual([])
    expect(await namesFor({ search: `archivado ${runId}` })).toEqual([])
  })

  it('filters by event type', async () => {
    expect(await namesFor({ search: runId, eventTypeId: typeIds.Ciclismo })).toEqual([
      CHIMBORAZO(),
      RUTA(),
    ])
  })

  it('keeps only events with at least one photo when hasPhotos is true', async () => {
    expect(await namesFor({ search: runId, hasPhotos: true })).toEqual([CHIMBORAZO()])
  })

  it('does not filter when hasPhotos is false', async () => {
    expect(await namesFor({ search: runId, hasPhotos: false })).toEqual([
      CHIMBORAZO(),
      TRAIL(),
      RUTA(),
    ])
  })

  it('combines search, event type and hasPhotos', async () => {
    expect(
      await namesFor({
        search: `tungurahua ${runId}`,
        eventTypeId: typeIds.Ciclismo,
        hasPhotos: true,
      }),
    ).toEqual([CHIMBORAZO()])
    expect(
      await namesFor({
        search: `tungurahua ${runId}`,
        eventTypeId: typeIds.Trail,
        hasPhotos: true,
      }),
    ).toEqual([])
  })

  it('paginates and counts the filtered set, not the whole table', async () => {
    const first = await list({ search: runId }, new Pagination(1, 2))
    const second = await list({ search: runId }, new Pagination(2, 2))

    expect(first.total).toBe(3)
    expect(second.total).toBe(3)
    expect(first.items.map((item) => item.name)).toEqual([CHIMBORAZO(), TRAIL()])
    expect(second.items.map((item) => item.name)).toEqual([RUTA()])
  })

  it('answers an empty page with total zero when nothing matches', async () => {
    const page = await list({ search: `nada-que-ver-${runId}` })

    expect(page.items).toEqual([])
    expect(page.total).toBe(0)
  })

  describe('getPublicEventFilters', () => {
    it('offers only event types that have a publicly listed event, sorted by name', async () => {
      const filters = await repo.getPublicEventFilters()
      const ids = filters.eventTypes.map((type) => type.id)
      const names = filters.eventTypes.map((type) => type.name)

      expect(ids).toContain(typeIds.Ciclismo)
      expect(ids).toContain(typeIds.Trail)
      expect(ids).not.toContain(typeIds.SinEventos)
      expect(ids).not.toContain(typeIds.SoloOcultos)
      expect(filters.eventTypes.find((type) => type.id === typeIds.Trail)).toEqual({
        id: typeIds.Trail,
        name: `${runId} Trail`,
      })
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    })
  })
})
