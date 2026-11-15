import { randomUUID } from 'node:crypto'
import type { PublicEventFiltersProjection } from '@events/application/projections'
import { PUBLICLY_LISTED_EVENT } from '@events/infrastructure/public-event-rule'
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

/**
 * Runs against the shared development database, so every assertion is either scoped to the rows
 * this suite creates (their names and the search term carry `runId`) or is an invariant that holds
 * whatever else the table holds.
 */
describe('public events list: search and filters', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: EventReadRepository

  const runId = `pf-${randomUUID().slice(0, 8)}`

  let tenantId: string
  let foreignCountryId: number | undefined
  let foreignProvinceId: number | undefined
  const provinceIds: Record<string, number> = {}
  const cantonIds: number[] = []
  const typeIds: Record<string, number> = {}
  const eventIds: Record<string, string> = {}

  const NO_FILTERS: PublicEventListFilters = {
    search: null,
    eventTypeIds: [],
    provinceIds: [],
    from: null,
    to: null,
  }

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

  async function facets(filters: Partial<PublicEventListFilters> = {}) {
    return repo.getPublicEventFilters({ ...NO_FILTERS, ...filters })
  }

  /** Count per option for the rows of this suite, keyed by a readable name. */
  function typeCounts(result: PublicEventFiltersProjection) {
    return Object.fromEntries(
      Object.entries(typeIds).map(([key, id]) => [
        key,
        result.eventTypes.find((type) => type.id === id)?.count,
      ]),
    )
  }

  function provinceCounts(result: PublicEventFiltersProjection) {
    return Object.fromEntries(
      Object.entries(provinceIds).map(([key, id]) => {
        const province = result.provinces.find((item) => item.id === id)
        return [key, province && { count: province.count, hasEvents: province.hasEvents }]
      }),
    )
  }

  function nonEmptyMonths(result: PublicEventFiltersProjection) {
    return result.months.filter((month) => month.count > 0)
  }

  const sum = (items: { count: number }[]) => items.reduce((total, item) => total + item.count, 0)

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
    const provinceNames: Record<string, string> = {
      tungurahua: `Tungurahúa ${runId}`,
      azuay: `Azuay ${runId}`,
      vacia: `Vacía ${runId}`,
      oculta: `Oculta ${runId}`,
    }
    for (const [key, name] of Object.entries(provinceNames)) {
      const province = await prisma.province.create({
        data: { name, code: `${key.slice(0, 2)}${runId.slice(3, 11)}`, country_id: country.id },
      })
      provinceIds[key] = province.id
    }
    // A country whose only event is hidden: none of its provinces may be offered.
    const takenCodes = new Set((await prisma.country.findMany()).map((item) => item.iso_code))
    const freeCode = Array.from({ length: 26 }, (_, index) => `X${String.fromCharCode(65 + index)}`)
      .concat(Array.from({ length: 14 }, (_, index) => `Q${String.fromCharCode(77 + index)}`))
      .find((code) => !takenCodes.has(code))
    if (!freeCode) throw new Error('no free iso code for the test country')
    const foreignCountry = await prisma.country.create({
      data: { name: `País ${runId}`, iso_code: freeCode },
    })
    foreignCountryId = foreignCountry.id
    const foreignProvince = await prisma.province.create({
      data: {
        name: `Lejana ${runId}`,
        code: `le${runId.slice(3, 11)}`,
        country_id: foreignCountry.id,
      },
    })
    foreignProvinceId = foreignProvince.id

    const canton = await prisma.canton.create({
      data: { name: `Cañar ${runId}`, province_id: provinceIds.tungurahua },
    })
    cantonIds.push(canton.id)

    const tenant = await prisma.tenant.create({
      data: { name: `${runId} tenant`, is_platform: false },
    })
    tenantId = tenant.id

    for (const key of ['Ciclismo', 'Trail', 'Downhill', 'SinEventos', 'SoloOcultos']) {
      const type = await prisma.eventType.create({ data: { name: `${runId} ${key}` } })
      typeIds[key] = type.id
    }

    async function createEvent(
      key: string,
      data: {
        name: string
        type: string
        startDate: string
        endDate?: string
        province?: string
        withCanton?: boolean
        cover?: boolean
        archived?: boolean
        photos?: number
      },
    ) {
      const event = await prisma.event.create({
        data: {
          name: data.name,
          slug: `event-${runId}-${key}`,
          start_date: new Date(data.startDate),
          end_date: new Date(data.endDate ?? data.startDate),
          tenant_id: tenantId,
          event_type_id: typeIds[data.type],
          province_id:
            data.province === 'lejana'
              ? foreignProvinceId
              : data.province
                ? provinceIds[data.province]
                : null,
          canton_id: data.withCanton ? canton.id : null,
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

    await createEvent('agosto', {
      name: `Descenso de agosto ${runId}`,
      type: 'Downhill',
      startDate: '2026-08-01',
      province: 'azuay',
    })
    // Starts on the last day of July and runs into August: only start_date counts.
    await createEvent('julio', {
      name: `Fin de julio ${runId}`,
      type: 'Ciclismo',
      startDate: '2026-07-31',
      endDate: '2026-08-02',
      province: 'tungurahua',
    })
    await createEvent('chimborazo', {
      name: `Vuelta al Chimborazó ${runId}`,
      type: 'Ciclismo',
      startDate: '2026-03-01',
      province: 'tungurahua',
      withCanton: true,
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
    await createEvent('diciembre', {
      name: `Cierre de año ${runId}`,
      type: 'Downhill',
      startDate: '2025-12-31',
      province: 'azuay',
    })
    await createEvent('sinPortada', {
      name: `Sin portada ${runId}`,
      type: 'SoloOcultos',
      startDate: '2026-04-01',
      province: 'oculta',
      cover: false,
      photos: 1,
    })
    await createEvent('archivado', {
      name: `Archivado ${runId}`,
      type: 'SoloOcultos',
      startDate: '2026-05-01',
      province: 'oculta',
      archived: true,
      photos: 1,
    })
    await createEvent('lejano', {
      name: `Lejano oculto ${runId}`,
      type: 'SoloOcultos',
      startDate: '2026-05-02',
      province: 'lejana',
      cover: false,
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
      await prisma.canton.deleteMany({ where: { id: { in: cantonIds } } })
      const provinces = [
        ...Object.values(provinceIds),
        ...(foreignProvinceId ? [foreignProvinceId] : []),
      ]
      await prisma.province.deleteMany({ where: { id: { in: provinces } } })
      if (foreignCountryId) await prisma.country.deleteMany({ where: { id: foreignCountryId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  const AGOSTO = () => `Descenso de agosto ${runId}`
  const JULIO = () => `Fin de julio ${runId}`
  const CHIMBORAZO = () => `Vuelta al Chimborazó ${runId}`
  const TRAIL = () => `Trail 100%_real ${runId}`
  const RUTA = () => `Ruta sin acento ${runId}`
  const DICIEMBRE = () => `Cierre de año ${runId}`
  const ALL_VISIBLE = () => [AGOSTO(), JULIO(), CHIMBORAZO(), TRAIL(), RUTA(), DICIEMBRE()]

  describe('getPublicEventsList', () => {
    it('without filters lists only visible events, newest first, each with its event type', async () => {
      const page = await list()
      const mine = page.items.filter((item) => item.name.endsWith(runId))

      expect(mine.map((item) => item.name)).toEqual(ALL_VISIBLE())
      expect(mine[2]).toMatchObject({
        eventTypeId: typeIds.Ciclismo,
        eventTypeName: `${runId} Ciclismo`,
        photoCount: 2,
        provinceName: `Tungurahúa ${runId}`,
        cantonName: `Cañar ${runId}`,
      })
      expect(mine[3]).toMatchObject({ eventTypeId: typeIds.Trail, photoCount: 0 })
    })

    describe('search', () => {
      it('matches the event name partially, ignoring case', async () => {
        expect(await namesFor({ search: `SIN ACENTO ${runId}` })).toEqual([RUTA()])
      })

      it('ignores accents in the event name and in the term', async () => {
        expect(await namesFor({ search: `chimborazo ${runId}` })).toEqual([CHIMBORAZO()])
        expect(await namesFor({ search: `sín acentó ${runId}` })).toEqual([RUTA()])
      })

      it('matches the canton name, ñ included', async () => {
        expect(await namesFor({ search: `canar ${runId}` })).toEqual([CHIMBORAZO()])
      })

      it('matches the province name', async () => {
        expect(await namesFor({ search: `tungurahua ${runId}` })).toEqual([JULIO(), CHIMBORAZO()])
      })

      it('treats % and _ typed by the user as literal text', async () => {
        expect(await namesFor({ search: `100%_real ${runId}` })).toEqual([TRAIL()])
        expect(await namesFor({ search: `Ruta%${runId}` })).toEqual([])
        expect(await namesFor({ search: `Ruta_sin acento ${runId}` })).toEqual([])
      })

      it('never surfaces a hidden event', async () => {
        expect(await namesFor({ search: `portada ${runId}` })).toEqual([])
        expect(await namesFor({ search: `archivado ${runId}` })).toEqual([])
      })
    })

    it('matches any of several event types', async () => {
      expect(
        await namesFor({ search: runId, eventTypeIds: [typeIds.Downhill, typeIds.Trail] }),
      ).toEqual([AGOSTO(), TRAIL(), DICIEMBRE()])
    })

    it('matches any of several provinces, leaving out events without one', async () => {
      expect(
        await namesFor({
          search: runId,
          provinceIds: [provinceIds.tungurahua, provinceIds.azuay],
        }),
      ).toEqual([AGOSTO(), JULIO(), CHIMBORAZO(), DICIEMBRE()])
    })

    it('matches a month range that crosses the year', async () => {
      expect(await namesFor({ search: runId, from: '2025-12', to: '2026-01' })).toEqual([
        RUTA(),
        DICIEMBRE(),
      ])
    })

    it('places an event in the month of its start date, even when it runs into the next', async () => {
      expect(await namesFor({ search: runId, from: '2026-07', to: '2026-07' })).toEqual([JULIO()])
      expect(await namesFor({ search: runId, from: '2026-08', to: '2026-08' })).toEqual([AGOSTO()])
    })

    it('includes the first and the last day of the range', async () => {
      expect(await namesFor({ search: runId, from: '2026-01', to: '2026-07' })).toEqual([
        JULIO(),
        CHIMBORAZO(),
        TRAIL(),
        RUTA(),
      ])
    })

    it('crosses the filters with each other and with the search', async () => {
      const filters = {
        eventTypeIds: [typeIds.Ciclismo, typeIds.Downhill],
        provinceIds: [provinceIds.tungurahua],
        from: '2026-03',
        to: '2026-08',
      }
      expect(await namesFor({ ...filters, search: runId })).toEqual([JULIO(), CHIMBORAZO()])
      expect(await namesFor({ ...filters, search: `chimborazo ${runId}` })).toEqual([CHIMBORAZO()])
      expect(await namesFor({ ...filters, search: `trail ${runId}` })).toEqual([])
    })

    it('never surfaces a hidden event through a filter', async () => {
      expect(await namesFor({ eventTypeIds: [typeIds.SoloOcultos] })).toEqual([])
      expect(await namesFor({ provinceIds: [provinceIds.oculta] })).toEqual([])
    })

    it('paginates and counts the filtered set, not the whole table', async () => {
      const first = await list({ search: runId }, new Pagination(1, 4))
      const second = await list({ search: runId }, new Pagination(2, 4))

      expect(first.total).toBe(6)
      expect(second.total).toBe(6)
      expect(first.items.map((item) => item.name)).toEqual(ALL_VISIBLE().slice(0, 4))
      expect(second.items.map((item) => item.name)).toEqual(ALL_VISIBLE().slice(4))
    })

    it('answers an empty page with total zero when nothing matches', async () => {
      const page = await list({ search: `nada-que-ver-${runId}` })

      expect(page.items).toEqual([])
      expect(page.total).toBe(0)
    })
  })

  describe('getPublicEventFilters', () => {
    it('offers only event types with a publicly listed event, sorted by name', async () => {
      const result = await facets()
      const ids = result.eventTypes.map((type) => type.id)
      const names = result.eventTypes.map((type) => type.name)

      expect(ids).toEqual(
        expect.arrayContaining([typeIds.Ciclismo, typeIds.Trail, typeIds.Downhill]),
      )
      expect(ids).not.toContain(typeIds.SinEventos)
      expect(ids).not.toContain(typeIds.SoloOcultos)
      expect(result.eventTypes.find((type) => type.id === typeIds.Trail)).toEqual({
        id: typeIds.Trail,
        name: `${runId} Trail`,
        count: 1,
      })
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')))
    })

    it('offers every province of the countries with a visible event, sorted by name', async () => {
      const result = await facets()
      const names = result.provinces.map((province) => province.name)
      const listed = await prisma.event.findMany({
        where: { ...PUBLICLY_LISTED_EVENT, province_id: { not: null } },
        select: { province: { select: { country_id: true } } },
      })
      const countries = [...new Set(listed.map((event) => event.province?.country_id as number))]

      expect(result.provinces).toHaveLength(
        await prisma.province.count({ where: { country_id: { in: countries } } }),
      )
      expect(result.provinces.map((province) => province.id)).not.toContain(foreignProvinceId)
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')))
      expect(provinceCounts(result)).toEqual({
        tungurahua: { count: 2, hasEvents: true },
        azuay: { count: 2, hasEvents: true },
        vacia: { count: 0, hasEvents: false },
        oculta: { count: 0, hasEvents: false },
      })
      expect(result.provinces.find((province) => province.id === provinceIds.azuay)).toEqual({
        id: provinceIds.azuay,
        name: `Azuay ${runId}`,
        count: 2,
        hasEvents: true,
      })
    })

    it('offers months in ascending order, placing each event in its start month', async () => {
      const result = await facets({ search: runId })
      const months = result.months.map((item) => item.month)

      expect(months).toEqual([...months].sort())
      expect(nonEmptyMonths(result)).toEqual([
        { month: '2025-12', count: 1 },
        { month: '2026-01', count: 1 },
        { month: '2026-02', count: 1 },
        { month: '2026-03', count: 1 },
        { month: '2026-07', count: 1 },
        { month: '2026-08', count: 1 },
      ])
    })

    it('never offers the month of a hidden event because of that event', async () => {
      const result = await facets({ search: runId })

      expect(result.months.find((item) => item.month === '2026-04')?.count ?? 0).toBe(0)
      expect(result.months.find((item) => item.month === '2026-05')?.count ?? 0).toBe(0)
    })

    it('without filters, counts the totals: each group adds up to the listed total', async () => {
      const [result, page, withoutProvince] = await Promise.all([
        facets(),
        list({}, new Pagination(1, 1)),
        prisma.event.count({ where: { ...PUBLICLY_LISTED_EVENT, province_id: null } }),
      ])

      expect(sum(result.eventTypes)).toBe(page.total)
      expect(sum(result.months)).toBe(page.total)
      // An event without a province counts in no province.
      expect(sum(result.provinces)).toBe(page.total - withoutProvince)
      expect(typeCounts(result)).toMatchObject({ Ciclismo: 3, Trail: 1, Downhill: 2 })
    })

    it('counts each group with the other filters but not its own', async () => {
      const result = await facets({ search: runId, eventTypeIds: [typeIds.Downhill] })

      expect(typeCounts(result)).toMatchObject({ Ciclismo: 3, Trail: 1, Downhill: 2 })
      expect(provinceCounts(result)).toMatchObject({
        tungurahua: { count: 0, hasEvents: true },
        azuay: { count: 2, hasEvents: true },
      })
      expect(nonEmptyMonths(result)).toEqual([
        { month: '2025-12', count: 1 },
        { month: '2026-08', count: 1 },
      ])
    })

    it('keeps an option whose count drops to zero', async () => {
      const result = await facets({ search: runId, provinceIds: [provinceIds.tungurahua] })

      expect(typeCounts(result)).toMatchObject({ Ciclismo: 2, Trail: 0, Downhill: 0 })
      expect(result.eventTypes.find((type) => type.id === typeIds.Trail)?.count).toBe(0)
      expect(provinceCounts(result)).toMatchObject({
        tungurahua: { count: 2 },
        azuay: { count: 2 },
      })
      expect(nonEmptyMonths(result)).toEqual([
        { month: '2026-03', count: 1 },
        { month: '2026-07', count: 1 },
      ])
    })

    it('leaves the month counts out of the month range', async () => {
      const result = await facets({ search: runId, from: '2026-07', to: '2026-08' })

      expect(nonEmptyMonths(result)).toHaveLength(6)
      expect(typeCounts(result)).toMatchObject({ Ciclismo: 1, Trail: 0, Downhill: 1 })
      expect(provinceCounts(result)).toMatchObject({
        tungurahua: { count: 1 },
        azuay: { count: 1 },
      })
    })

    it('narrows every count by the search', async () => {
      const result = await facets({ search: `chimborazo ${runId}` })

      expect(typeCounts(result)).toMatchObject({ Ciclismo: 1, Trail: 0, Downhill: 0 })
      expect(provinceCounts(result)).toMatchObject({
        tungurahua: { count: 1 },
        azuay: { count: 0 },
      })
      expect(nonEmptyMonths(result)).toEqual([{ month: '2026-03', count: 1 }])
    })

    it('keeps the options, and hasEvents, whatever the filters', async () => {
      const result = await facets({
        search: `nada-que-ver-${runId}`,
        provinceIds: [provinceIds.tungurahua],
      })

      expect(typeCounts(result)).toEqual({
        Ciclismo: 0,
        Trail: 0,
        Downhill: 0,
        SinEventos: undefined,
        SoloOcultos: undefined,
      })
      expect(provinceCounts(result)).toEqual({
        tungurahua: { count: 0, hasEvents: true },
        azuay: { count: 0, hasEvents: true },
        vacia: { count: 0, hasEvents: false },
        oculta: { count: 0, hasEvents: false },
      })
      expect(result.months.find((item) => item.month === '2026-07')).toEqual({
        month: '2026-07',
        count: 0,
      })
    })

    it('adds up to the listed total in a group that has nothing selected', async () => {
      const filters = { search: runId, provinceIds: [provinceIds.tungurahua, provinceIds.azuay] }
      const [result, page] = await Promise.all([facets(filters), list(filters)])

      expect(page.total).toBe(4)
      expect(sum(result.eventTypes)).toBe(page.total)
      expect(sum(result.months)).toBe(page.total)
    })
  })
})
