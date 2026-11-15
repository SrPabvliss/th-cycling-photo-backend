import { randomUUID } from 'node:crypto'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import type { PrismaClient } from '@generated/prisma/client'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { Pagination } from '@shared/application'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { createUserFixture } from '../../../../../test/fixtures/factories/user.factory'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'

const fakeCdn = {
  assetUrl: () => 'https://cdn.test/asset',
  photoUrl: () => 'https://cdn.test/photo',
  galleryUrl: () => 'https://cdn.test/gallery',
} as unknown as CdnUrlBuilder

/**
 * A rider types their plate number as they know it, usually without the zeros the plate or the
 * OCR put in front: 39 for 039. The public search ignores leading zeros on both sides, without
 * touching what is stored. Searching only zeros still finds only the zero plates, never every
 * plate.
 */
describe('public search of photos by plate number', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: EventReadRepository

  const runId = `bib-${randomUUID().slice(0, 8)}`
  let tenantId: string
  let eventTypeId: number
  let eventId: string
  let reviewerId: string
  const photoByPlate = new Map<string, string>()

  const NO_FILTERS = { photoCategoryId: null, section: null } as const

  async function search(bibNumber: string, bibMatch: 'exact' | 'starts' | 'contains') {
    const page = await repo.getPublicPhotos(eventId, new Pagination(1, 50), {
      ...NO_FILTERS,
      bibNumber,
      bibMatch,
    })
    const plateById = new Map([...photoByPlate].map(([plate, id]) => [id, plate]))
    return page.items.map((item) => plateById.get(item.id)).sort()
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
    const event = await prisma.event.create({
      data: {
        name: `${runId} evento`,
        slug: runId,
        start_date: new Date('2026-06-01'),
        end_date: new Date('2026-06-01'),
        tenant_id: tenantId,
        event_type_id: eventTypeId,
        status: 'active',
      },
    })
    eventId = event.id

    for (const plate of ['039', '39', '390', '139', '0', '00', '7']) {
      const photo = await prisma.photo.create({
        data: {
          event_id: eventId,
          filename: `${plate}.jpg`,
          storage_key: `photos/${runId}/${plate}`,
          public_slug: randomUUID().slice(0, 20),
          file_size: BigInt(1000),
        },
      })
      await prisma.photoBib.create({ data: { photo_id: photo.id, source: 'ai', digits: plate } })
      photoByPlate.set(plate, photo.id)
    }

    // A reviewer correction is what counts: this photo was read 1 and corrected to 040.
    const corrected = await prisma.photo.create({
      data: {
        event_id: eventId,
        filename: 'corrected.jpg',
        storage_key: `photos/${runId}/corrected`,
        public_slug: randomUUID().slice(0, 20),
        file_size: BigInt(1000),
      },
    })
    const bib = await prisma.photoBib.create({
      data: { photo_id: corrected.id, source: 'ai', digits: '1' },
    })
    reviewerId = await createUserFixture(prisma as unknown as PrismaClient)
    await prisma.correction.create({
      data: {
        photo_id: corrected.id,
        reviewer_id: reviewerId,
        target_type: 'photo_bib',
        target_id: bib.id,
        field: 'digits',
        old_value: '1',
        new_value: '040',
      },
    })
    photoByPlate.set('040 (corrected)', corrected.id)
  })

  afterAll(async () => {
    if (prisma) {
      const ids = [...photoByPlate.values()]
      const bibs = await prisma.photoBib.findMany({ where: { photo_id: { in: ids } } })
      await prisma.correction.deleteMany({
        where: { target_type: 'photo_bib', target_id: { in: bibs.map((b) => b.id) } },
      })
      await prisma.photoBib.deleteMany({ where: { photo_id: { in: ids } } })
      await prisma.photo.deleteMany({ where: { id: { in: ids } } })
      if (eventId) await prisma.event.deleteMany({ where: { id: eventId } })
      if (reviewerId) await prisma.user.deleteMany({ where: { id: reviewerId } })
      if (eventTypeId) await prisma.eventType.deleteMany({ where: { id: eventTypeId } })
      if (tenantId) await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  describe('exact', () => {
    it.each([
      ['39', ['039', '39']],
      ['039', ['039', '39']],
      ['0039', ['039', '39']],
      ['40', ['040 (corrected)']],
      ['7', ['7']],
    ])('finds plate %s written with or without leading zeros', async (value, plates) => {
      expect(await search(value, 'exact')).toEqual(plates)
    })

    it('finds the zero plates, and only them, for a number made of zeros', async () => {
      expect(await search('0', 'exact')).toEqual(['0', '00'])
      expect(await search('000', 'exact')).toEqual(['0', '00'])
    })
  })

  describe('starts with', () => {
    it('ignores the leading zeros of the plate and of the search', async () => {
      expect(await search('39', 'starts')).toEqual(['039', '39', '390'])
      expect(await search('039', 'starts')).toEqual(['039', '39', '390'])
    })

    it('never turns a search of zeros into a search of every plate', async () => {
      expect(await search('0', 'starts')).toEqual(['0', '00', '039', '040 (corrected)'])
    })
  })

  describe('contains', () => {
    it('works as before', async () => {
      expect(await search('39', 'contains')).toEqual(['039', '139', '39', '390'])
    })
  })
})
