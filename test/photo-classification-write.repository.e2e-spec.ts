import {
  AttributeSource,
  BibReadingStatus,
  ColorRegion,
  type PrismaClient,
  ProcessingStageName,
  ProcessingStageStatus,
} from '@generated/prisma/client'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import configuration from '../src/config/configuration'
import type { PersistResultInput } from '../src/modules/classifications/domain/ports'
import { PhotoClassificationWriteRepository } from '../src/modules/classifications/infrastructure/repositories/photo-classification-write.repository'
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service'
import { createPhotoFixture } from './fixtures/factories/photo.factory'
import { createEventFixture } from './fixtures/factories/user.factory'

describe('PhotoClassificationWriteRepository (integration)', () => {
  let prisma: PrismaService
  let repo: PhotoClassificationWriteRepository
  let photoId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'test'}`, '.env'],
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [PrismaService, PhotoClassificationWriteRepository],
    }).compile()
    prisma = moduleRef.get(PrismaService)
    repo = moduleRef.get(PhotoClassificationWriteRepository)
    await prisma.$connect()
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE photos, photo_processings, photo_processing_stages, photo_detections, photo_bibs, photo_colors, corrections, events RESTART IDENTITY CASCADE',
    )
    const eventId = await createEventFixture(prisma as unknown as PrismaClient)
    photoId = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  const buildInput = (): PersistResultInput => ({
    photoId,
    processing: {
      schemaVersion: '1.0',
      totalMs: 5722,
      modelVersions: { detection: 'yolo', ocr: 'parseq', color: 'gemini' },
      startedAt: new Date(),
      completedAt: new Date(),
    },
    stages: [
      {
        stage: ProcessingStageName.detection,
        status: ProcessingStageStatus.ok,
        ms: 59,
        itemsProcessed: 1,
        itemsSucceeded: 1,
        itemsFailed: 0,
        notes: [],
      },
      {
        stage: ProcessingStageName.ocr,
        status: ProcessingStageStatus.ok,
        ms: 287,
        itemsProcessed: 1,
        itemsSucceeded: 1,
        itemsFailed: 0,
        notes: [],
      },
      {
        stage: ProcessingStageName.color,
        status: ProcessingStageStatus.ok,
        ms: 5350,
        itemsProcessed: 1,
        itemsSucceeded: 1,
        itemsFailed: 0,
        notes: [],
      },
    ],
    detections: [
      {
        className: 'competidor_number',
        classId: 1,
        confidence: 0.95,
        bbox: [0.1, 0.3, 0.3, 0.55],
      },
    ],
    bibs: [
      {
        source: AttributeSource.ai,
        digits: '20',
        confidence: 0.98,
        confidencePerDigit: [0.99, 0.97],
        status: BibReadingStatus.read,
        rejectionReason: null,
        rawOcrText: '20',
        bboxSource: [0.1, 0.3, 0.3, 0.55],
        preprocessingApplied: [],
        processingMs: 287,
        cropPath: null,
      },
    ],
    colors: [
      {
        source: AttributeSource.ai,
        region: ColorRegion.helmet,
        primaryColor: 'rojo',
        secondaryColor: 'blanco',
        confidence: 0.9,
        bboxSource: [0.4, 0.05, 0.58, 0.22],
        strategy: 'gemini-2.5-flash',
        processingMs: 1733,
        cropPath: null,
      },
    ],
  })

  it('persists header + 3 stages + 1 detection + 1 bib + 1 color in transaction', async () => {
    const { processingId } = await repo.persistResult(buildInput())
    expect(processingId).toBeTruthy()

    const stages = await prisma.photoProcessingStage.findMany({
      where: { photo_processing_id: processingId },
    })
    expect(stages).toHaveLength(3)
    const detections = await prisma.photoDetection.findMany({
      where: { photo_processing_id: processingId },
    })
    expect(detections).toHaveLength(1)
    const bibs = await prisma.photoBib.findMany({
      where: { photo_processing_id: processingId },
    })
    expect(bibs).toHaveLength(1)
    expect(bibs[0].source).toBe(AttributeSource.ai)
    const colors = await prisma.photoColor.findMany({
      where: { photo_processing_id: processingId },
    })
    expect(colors).toHaveLength(1)
  })

  it('does NOT mutate Photo.status (handler responsibility)', async () => {
    const before = await prisma.photo.findUniqueOrThrow({
      where: { id: photoId },
      select: { status: true },
    })
    await repo.persistResult(buildInput())
    const after = await prisma.photo.findUniqueOrThrow({
      where: { id: photoId },
      select: { status: true },
    })
    expect(after.status).toBe(before.status)
  })

  it('idempotency: 2 calls = 2 PhotoProcessing rows', async () => {
    await repo.persistResult(buildInput())
    await repo.persistResult(buildInput())
    const count = await prisma.photoProcessing.count({ where: { photo_id: photoId } })
    expect(count).toBe(2)
  })

  it('persists crop_path when provided in PersistBibInput and PersistColorInput', async () => {
    const input = buildInput()
    input.bibs[0].cropPath = 'events/e/photos/p/crops/bibs/0.jpg'
    input.colors[0].cropPath = 'events/e/photos/p/crops/colors/helmet/0.jpg'
    const { processingId } = await repo.persistResult(input)

    const bibs = await prisma.photoBib.findMany({
      where: { photo_processing_id: processingId },
    })
    expect(bibs[0].crop_path).toBe('events/e/photos/p/crops/bibs/0.jpg')

    const colors = await prisma.photoColor.findMany({
      where: { photo_processing_id: processingId },
    })
    expect(colors[0].crop_path).toBe('events/e/photos/p/crops/colors/helmet/0.jpg')
  })

  it('persists null crop_path when cropPath is null', async () => {
    const { processingId } = await repo.persistResult(buildInput())
    const bibs = await prisma.photoBib.findMany({
      where: { photo_processing_id: processingId },
    })
    expect(bibs[0].crop_path).toBeNull()
    const colors = await prisma.photoColor.findMany({
      where: { photo_processing_id: processingId },
    })
    expect(colors[0].crop_path).toBeNull()
  })

  it('persistFailure writes status=failed with error_message', async () => {
    const { processingId } = await repo.persistFailure({
      photoId,
      schemaVersion: '1.0',
      errorMessage: 'image_id mismatch',
      startedAt: new Date(),
    })
    const row = await prisma.photoProcessing.findUniqueOrThrow({
      where: { id: processingId },
    })
    expect(row.status).toBe('failed')
    expect(row.error_message).toBe('image_id mismatch')
    const stages = await prisma.photoProcessingStage.findMany({
      where: { photo_processing_id: processingId },
    })
    expect(stages).toHaveLength(0)
  })
})
