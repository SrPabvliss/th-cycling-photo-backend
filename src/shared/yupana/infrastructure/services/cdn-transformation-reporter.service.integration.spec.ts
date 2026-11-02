import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import {
  CDN_RETIRED_SLUG_REPOSITORY,
  CDN_TRANSFORMATION_REPOSITORY,
  CDN_TRANSFORMATION_SOURCE,
  type CdnTransformationPoint,
  type ICdnTransformationSource,
  YUPANA_OUTBOX_REPOSITORY,
} from '../../domain/ports'
import { CdnRetiredSlugRepository } from '../repositories/cdn-retired-slug.repository'
import { CdnTransformationRepository } from '../repositories/cdn-transformation.repository'
import { YupanaOutboxRepository } from '../repositories/yupana-outbox.repository'
import { CdnTransformationReporterService } from './cdn-transformation-reporter.service'

class ProgrammableSource implements ICdnTransformationSource {
  days = new Map<string, CdnTransformationPoint[]>()
  first: string | null = null
  failNext = false
  reads: string[] = []

  isConfigured(): boolean {
    return true
  }

  async readDay(day: string): Promise<CdnTransformationPoint[]> {
    this.reads.push(day)
    if (this.failNext) {
      this.failNext = false
      throw new Error('analytics engine down')
    }
    return this.days.get(day) ?? []
  }

  async findFirstDay(): Promise<string | null> {
    return this.first
  }
}

describe('CdnTransformationReporterService (integration)', () => {
  let module: TestingModule
  let prisma: PrismaService
  let reporter: CdnTransformationReporterService
  let source: ProgrammableSource
  let tenantId: string
  let eventId: string
  let eventTypeId: number

  const key = (letter: string): string => letter.repeat(64)
  const shortSlug = (): string => randomUUID().replace(/-/g, '').slice(0, 20)

  async function cdnOutbox() {
    return prisma.yupanaOutboxItem.findMany({
      where: { item_key: { startsWith: 'cdn:' } },
      orderBy: { item_key: 'asc' },
    })
  }

  async function createPhoto(overrides: { retouchedSlug?: string } = {}) {
    const id = randomUUID()
    return prisma.photo.create({
      data: {
        id,
        event_id: eventId,
        filename: `IMG_${id}.jpg`,
        storage_key: `events/${eventId}/photos/${id}.jpg`,
        public_slug: shortSlug(),
        file_size: 1024n,
        retouched_public_slug: overrides.retouchedSlug ?? null,
      },
    })
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
        CdnTransformationReporterService,
        { provide: YUPANA_OUTBOX_REPOSITORY, useClass: YupanaOutboxRepository },
        { provide: CDN_TRANSFORMATION_REPOSITORY, useClass: CdnTransformationRepository },
        { provide: CDN_RETIRED_SLUG_REPOSITORY, useClass: CdnRetiredSlugRepository },
        { provide: CDN_TRANSFORMATION_SOURCE, useValue: new ProgrammableSource() },
      ],
    }).compile()

    prisma = module.get(PrismaService)
    reporter = module.get(CdnTransformationReporterService)
    source = module.get(CDN_TRANSFORMATION_SOURCE)

    const tenant = await prisma.tenant.create({
      data: { name: `CDN Reporter ${randomUUID()}`, is_platform: false, event_quota: 10 },
    })
    tenantId = tenant.id
    const eventType = await prisma.eventType.create({ data: { name: `cdn-${shortSlug()}` } })
    eventTypeId = eventType.id
  })

  beforeEach(async () => {
    source.days.clear()
    source.first = null
    source.failNext = false
    source.reads = []
    await prisma.yupanaOutboxItem.deleteMany({ where: { item_key: { startsWith: 'cdn:' } } })
    await prisma.cdnTransformationSighting.deleteMany({})
    await prisma.cdnTransformationReportDay.deleteMany({})
    await prisma.cdnRetiredSlug.deleteMany({})
    const event = await prisma.event.create({
      data: {
        name: 'CDN Reporter Event',
        slug: `cdn-reporter-${randomUUID()}`,
        start_date: new Date('2026-10-01'),
        end_date: new Date('2026-10-02'),
        event_type_id: eventTypeId,
        tenant_id: tenantId,
        photo_quota: 100,
        photos_uploaded: 0,
      },
    })
    eventId = event.id
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.yupanaOutboxItem.deleteMany({ where: { item_key: { startsWith: 'cdn:' } } })
      await prisma.cdnTransformationSighting.deleteMany({})
      await prisma.cdnTransformationReportDay.deleteMany({})
      await prisma.cdnRetiredSlug.deleteMany({})
      await prisma.eventAsset.deleteMany({ where: { event: { tenant_id: tenantId } } })
      await prisma.photo.deleteMany({ where: { event: { tenant_id: tenantId } } })
      await prisma.event.deleteMany({ where: { tenant_id: tenantId } })
      await prisma.eventType.deleteMany({ where: { id: eventTypeId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
    }
    if (module) await module.close()
  })

  it('reports each combination once per month even across days', async () => {
    const photo = await createPhoto()
    source.first = '2026-11-03'
    source.days.set('2026-11-03', [
      { combinationKey: key('a'), kind: 'gallery', slug: photo.public_slug },
      { combinationKey: key('b'), kind: 'internal', slug: photo.public_slug },
    ])
    source.days.set('2026-11-04', [
      { combinationKey: key('b'), kind: 'internal', slug: photo.public_slug },
      { combinationKey: key('c'), kind: 'internal', slug: photo.public_slug },
    ])

    const run = await reporter.report(new Date('2026-11-05T03:00:00Z'))

    expect(run.processedDays).toEqual(['2026-11-03', '2026-11-04'])
    const items = await cdnOutbox()
    expect(items.map((item) => [item.item_key, (item.payload as any).payload.quantity])).toEqual([
      [`cdn:2026-11-03:${photo.id}`, 2],
      [`cdn:2026-11-04:${photo.id}`, 1],
    ])
    expect(items[0].photo_id).toBe(photo.id)
    expect(items[0].payload).toMatchObject({
      report_id: `cdn:2026-11-03:${photo.id}`,
      provider: 'cloudflare',
      kind: 'snapshot',
      measurement_status: 'complete',
      occurred_at: '2026-11-03T23:59:59Z',
      payload: {
        meter: 'cdn.unique_transformations',
        as_of: '2026-11-03',
        unit: 'count',
        subject: { photo_id: photo.id, domain_event_id: eventId },
      },
    })
  })

  it('counts a combination again in a new month', async () => {
    const photo = await createPhoto()
    source.first = '2026-10-31'
    for (const day of ['2026-10-31', '2026-11-01']) {
      source.days.set(day, [{ combinationKey: key('a'), kind: 'gallery', slug: photo.public_slug }])
    }

    await reporter.report(new Date('2026-11-02T03:00:00Z'))

    expect((await cdnOutbox()).map((item) => item.item_key)).toEqual([
      `cdn:2026-10-31:${photo.id}`,
      `cdn:2026-11-01:${photo.id}`,
    ])
  })

  it('groups new combinations by photo and sends covers as asset subjects', async () => {
    const retouchedSlug = shortSlug()
    const photo = await createPhoto({ retouchedSlug })
    const cover = await prisma.eventAsset.create({
      data: {
        event_id: eventId,
        asset_type: 'cover_image',
        storage_key: `events/${eventId}/assets/cover_image/${randomUUID()}.jpg`,
        public_slug: shortSlug(),
      },
    })
    source.first = '2026-11-03'
    source.days.set('2026-11-03', [
      { combinationKey: key('a'), kind: 'gallery', slug: photo.public_slug },
      { combinationKey: key('b'), kind: 'gallery', slug: retouchedSlug },
      { combinationKey: key('c'), kind: 'asset', slug: cover.public_slug },
    ])

    await reporter.report(new Date('2026-11-04T03:00:00Z'))

    const items = await cdnOutbox()
    const byKey = new Map(items.map((item) => [item.item_key, item]))
    expect((byKey.get(`cdn:2026-11-03:${photo.id}`)?.payload as any).payload.quantity).toBe(2)
    const coverItem = byKey.get(`cdn:2026-11-03:asset:${cover.id}`)
    expect(coverItem?.photo_id).toBeNull()
    expect((coverItem?.payload as any).payload).toMatchObject({
      quantity: 1,
      subject: { photo_id: `asset:${cover.id}`, domain_event_id: eventId },
    })
  })

  it('resolves a retired slug to its photo', async () => {
    const goneSlug = shortSlug()
    const goneId = randomUUID()
    await prisma.cdnRetiredSlug.create({
      data: { slug: goneSlug, photo_id: goneId, event_id: eventId },
    })
    source.first = '2026-11-03'
    source.days.set('2026-11-03', [{ combinationKey: key('a'), kind: 'gallery', slug: goneSlug }])

    await reporter.report(new Date('2026-11-04T03:00:00Z'))

    const items = await cdnOutbox()
    expect(items.map((item) => item.item_key)).toEqual([`cdn:2026-11-03:${goneId}`])
    expect((items[0].payload as any).payload.subject).toEqual({
      photo_id: goneId,
      domain_event_id: eventId,
    })
  })

  it('sends unresolved slugs as a count without subject or slug', async () => {
    const strangerSlug = `stranger${shortSlug()}`
    source.first = '2026-11-03'
    source.days.set('2026-11-03', [
      { combinationKey: key('a'), kind: 'gallery', slug: strangerSlug },
      { combinationKey: key('b'), kind: 'internal', slug: strangerSlug },
    ])

    await reporter.report(new Date('2026-11-04T03:00:00Z'))

    const items = await cdnOutbox()
    expect(items.map((item) => item.item_key)).toEqual(['cdn:2026-11-03:unresolved'])
    expect(items[0].photo_id).toBeNull()
    expect((items[0].payload as any).payload.quantity).toBe(2)
    expect((items[0].payload as any).payload.subject).toBeUndefined()
    expect(JSON.stringify(items[0].payload)).not.toContain(strangerSlug)
  })

  it('processes a day only once', async () => {
    const photo = await createPhoto()
    source.first = '2026-11-03'
    source.days.set('2026-11-03', [
      { combinationKey: key('a'), kind: 'gallery', slug: photo.public_slug },
    ])
    await reporter.report(new Date('2026-11-04T03:00:00Z'))
    source.reads = []

    const second = await reporter.report(new Date('2026-11-04T05:00:00Z'))

    expect(second.processedDays).toEqual([])
    expect(source.reads).toEqual([])
    expect(await cdnOutbox()).toHaveLength(1)
  })

  it('leaves the day pending when the source fails', async () => {
    const photo = await createPhoto()
    source.first = '2026-11-03'
    source.days.set('2026-11-03', [
      { combinationKey: key('a'), kind: 'gallery', slug: photo.public_slug },
    ])
    source.failNext = true

    await expect(reporter.report(new Date('2026-11-04T03:00:00Z'))).rejects.toThrow()
    expect(await prisma.cdnTransformationReportDay.count()).toBe(0)
    expect(await prisma.cdnTransformationSighting.count()).toBe(0)

    const retry = await reporter.report(new Date('2026-11-04T03:30:00Z'))
    expect(retry.processedDays).toEqual(['2026-11-03'])
    expect(await cdnOutbox()).toHaveLength(1)
  })

  it('waits two hours after the UTC day ends', async () => {
    source.first = '2026-11-03'

    const early = await reporter.report(new Date('2026-11-04T01:59:00Z'))
    expect(early.processedDays).toEqual([])

    const onTime = await reporter.report(new Date('2026-11-04T02:00:00Z'))
    expect(onTime.processedDays).toEqual(['2026-11-03'])
  })

  it('sends nothing for a day without data but marks it processed', async () => {
    source.first = '2026-11-03'

    const run = await reporter.report(new Date('2026-11-04T03:00:00Z'))

    expect(run.processedDays).toEqual(['2026-11-03'])
    expect(await cdnOutbox()).toEqual([])
    expect(await prisma.cdnTransformationReportDay.count()).toBe(1)
  })
})
