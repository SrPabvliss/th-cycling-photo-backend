import {
  AttributeSource,
  ColorRegion,
  CorrectionTargetType,
  type PrismaClient,
} from '@generated/prisma/client'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import configuration from '../src/config/configuration'
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service'
import { createPhotoFixture } from './fixtures/factories/photo.factory'
import { createEventFixture, createUserFixture } from './fixtures/factories/user.factory'

type EffectiveBibRow = {
  id: string
  digits_original: string
  digits_effective: string | null
  digits_was_corrected: boolean
}

type EffectiveColorRow = {
  id: string
  primary_effective: string | null
  primary_was_corrected: boolean
  secondary_effective: string | null
  secondary_was_corrected: boolean
}

describe('photo_bib_effective view', () => {
  let prisma: PrismaService
  let photoId: string
  let userId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'test'}`, '.env'],
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [PrismaService],
    }).compile()
    prisma = moduleRef.get(PrismaService)
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE photos, photo_processings, photo_processing_stages, photo_detections, photo_bibs, photo_colors, corrections, users, events RESTART IDENTITY CASCADE',
    )
    const eventId = await createEventFixture(prisma as unknown as PrismaClient)
    photoId = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    userId = await createUserFixture(prisma as unknown as PrismaClient)
  })

  const insertBib = async (digits: string) => {
    return prisma.photoBib.create({
      data: { photo_id: photoId, source: AttributeSource.ai, digits },
      select: { id: true },
    })
  }

  it('returns original digits when no correction exists', async () => {
    const bib = await insertBib('20')
    const rows = await prisma.$queryRaw<EffectiveBibRow[]>`
      SELECT * FROM photo_bib_effective WHERE id = ${bib.id}::uuid
    `
    expect(rows).toHaveLength(1)
    expect(rows[0].digits_original).toBe('20')
    expect(rows[0].digits_effective).toBe('20')
    expect(rows[0].digits_was_corrected).toBe(false)
  })

  it('returns corrected digits when correction exists', async () => {
    const bib = await insertBib('2O')
    await prisma.correction.create({
      data: {
        photo_id: photoId,
        target_type: CorrectionTargetType.photo_bib,
        target_id: bib.id,
        field: 'digits',
        old_value: '2O',
        new_value: '20',
        reviewer_id: userId,
      },
    })
    const rows = await prisma.$queryRaw<EffectiveBibRow[]>`
      SELECT * FROM photo_bib_effective WHERE id = ${bib.id}::uuid
    `
    expect(rows[0].digits_effective).toBe('20')
    expect(rows[0].digits_was_corrected).toBe(true)
  })

  it('returns latest correction when multiple exist (by corrected_at DESC)', async () => {
    const bib = await insertBib('2O')
    await prisma.correction.create({
      data: {
        photo_id: photoId,
        target_type: CorrectionTargetType.photo_bib,
        target_id: bib.id,
        field: 'digits',
        old_value: '2O',
        new_value: '20',
        reviewer_id: userId,
        corrected_at: new Date('2026-05-06T10:00:00Z'),
      },
    })
    await prisma.correction.create({
      data: {
        photo_id: photoId,
        target_type: CorrectionTargetType.photo_bib,
        target_id: bib.id,
        field: 'digits',
        old_value: '20',
        new_value: '21',
        reviewer_id: userId,
        corrected_at: new Date('2026-05-06T11:00:00Z'),
      },
    })
    const rows = await prisma.$queryRaw<EffectiveBibRow[]>`
      SELECT * FROM photo_bib_effective WHERE id = ${bib.id}::uuid
    `
    expect(rows[0].digits_effective).toBe('21')
    expect(rows[0].digits_was_corrected).toBe(true)
  })

  it('handles new_value=NULL via COALESCE fallback to original', async () => {
    // View uses COALESCE(correction.new_value, original) — NULL new_value
    // means "no change to apply", so effective falls back to the original digits.
    // The was_corrected flag still reflects that a correction row exists.
    const bib = await insertBib('20')
    await prisma.correction.create({
      data: {
        photo_id: photoId,
        target_type: CorrectionTargetType.photo_bib,
        target_id: bib.id,
        field: 'digits',
        old_value: '20',
        new_value: null,
        reviewer_id: userId,
      },
    })
    const rows = await prisma.$queryRaw<EffectiveBibRow[]>`
      SELECT * FROM photo_bib_effective WHERE id = ${bib.id}::uuid
    `
    expect(rows[0].digits_effective).toBe('20')
    expect(rows[0].digits_was_corrected).toBe(true)
  })
})

describe('photo_color_effective view', () => {
  let prisma: PrismaService
  let photoId: string
  let userId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'test'}`, '.env'],
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [PrismaService],
    }).compile()
    prisma = moduleRef.get(PrismaService)
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE photos, photo_processings, photo_processing_stages, photo_detections, photo_bibs, photo_colors, corrections, users, events RESTART IDENTITY CASCADE',
    )
    const eventId = await createEventFixture(prisma as unknown as PrismaClient)
    photoId = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    userId = await createUserFixture(prisma as unknown as PrismaClient)
  })

  it('handles primary and secondary corrections independently', async () => {
    const color = await prisma.photoColor.create({
      data: {
        photo_id: photoId,
        source: AttributeSource.ai,
        region: ColorRegion.helmet,
        primary_color: 'rojo',
        secondary_color: 'blanco',
      },
      select: { id: true },
    })
    await prisma.correction.create({
      data: {
        photo_id: photoId,
        target_type: CorrectionTargetType.photo_color,
        target_id: color.id,
        field: 'primary_color',
        old_value: 'rojo',
        new_value: 'naranja',
        reviewer_id: userId,
      },
    })
    const rows = await prisma.$queryRaw<EffectiveColorRow[]>`
      SELECT * FROM photo_color_effective WHERE id = ${color.id}::uuid
    `
    expect(rows[0].primary_effective).toBe('naranja')
    expect(rows[0].primary_was_corrected).toBe(true)
    expect(rows[0].secondary_effective).toBe('blanco')
    expect(rows[0].secondary_was_corrected).toBe(false)
  })
})
