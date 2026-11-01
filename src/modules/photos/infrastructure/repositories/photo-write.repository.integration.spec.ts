import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { PhotoWriteRepository } from './photo-write.repository'

describe('PhotoWriteRepository.markStalledAsFailed', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repository: PhotoWriteRepository
  let tenantId: string
  let eventId: string

  const now = new Date()
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000)
  const threshold = minutesAgo(15)

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
      providers: [PrismaService, PhotoWriteRepository],
    }).compile()

    prisma = module.get(PrismaService)
    repository = module.get(PhotoWriteRepository)

    const tenant = await prisma.tenant.create({
      data: { name: 'Reaper Tenant', is_platform: false, event_quota: 10 },
    })
    tenantId = tenant.id
    const eventType = await prisma.eventType.findFirstOrThrow()
    const event = await prisma.event.create({
      data: {
        name: 'Reaper Event',
        slug: `reaper-event-${crypto.randomUUID()}`,
        start_date: new Date('2026-09-01'),
        end_date: new Date('2026-09-02'),
        event_type_id: eventType.id,
        tenant_id: tenant.id,
      },
    })
    eventId = event.id
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.photo.deleteMany({ where: { event_id: eventId } })
      await prisma.event.deleteMany({ where: { id: eventId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  async function photo(
    status: 'pending' | 'processing' | 'processed' | 'failed',
    uploadedAt: Date,
    processingStartedAt: Date | null,
  ): Promise<string> {
    const key = crypto.randomUUID()
    const created = await prisma.photo.create({
      data: {
        event_id: eventId,
        filename: `IMG_${key}.jpg`,
        storage_key: `events/${eventId}/${key}.jpg`,
        public_slug: key.replaceAll('-', '').slice(0, 30),
        file_size: 1024n,
        status,
        uploaded_at: uploadedAt,
        processing_started_at: processingStartedAt,
      },
    })
    return created.id
  }

  async function statusOf(id: string): Promise<string> {
    return (await prisma.photo.findUniqueOrThrow({ where: { id } })).status
  }

  it('marks only processing photos older than the threshold, skips excluded ids and writes the failure row', async () => {
    const stalled = await photo('processing', minutesAgo(60), minutesAgo(20))
    const stalledWithoutStart = await photo('processing', minutesAgo(60), null)
    const recent = await photo('processing', minutesAgo(60), minutesAgo(5))
    const recentUpload = await photo('processing', minutesAgo(5), null)
    const excluded = await photo('processing', minutesAgo(60), minutesAgo(20))
    const pending = await photo('pending', minutesAgo(60), null)
    const processed = await photo('processed', minutesAgo(60), minutesAgo(30))

    const reaped = await repository.markStalledAsFailed(threshold, [excluded])

    expect(reaped.sort()).toEqual([stalled, stalledWithoutStart].sort())
    expect(await statusOf(stalled)).toBe('failed')
    expect(await statusOf(stalledWithoutStart)).toBe('failed')
    expect(await statusOf(recent)).toBe('processing')
    expect(await statusOf(recentUpload)).toBe('processing')
    expect(await statusOf(excluded)).toBe('processing')
    expect(await statusOf(pending)).toBe('pending')
    expect(await statusOf(processed)).toBe('processed')

    const failures = await prisma.photoProcessing.findMany({
      where: { photo_id: { in: [stalled, stalledWithoutStart] } },
    })
    expect(failures).toHaveLength(2)
    for (const failure of failures) {
      expect(failure.status).toBe('failed')
      expect(failure.error_message).toBe('photo.processing_stalled')
      expect(failure.schema_version).toBe('unknown')
    }
  })

  it('second run marks nothing', async () => {
    await photo('processing', minutesAgo(60), minutesAgo(20))

    const first = await repository.markStalledAsFailed(threshold, [])
    const second = await repository.markStalledAsFailed(threshold, [])

    expect(first.length).toBeGreaterThan(0)
    expect(second).toEqual([])
  })
})
