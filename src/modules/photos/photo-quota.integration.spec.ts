import { EVENT_READ_REPOSITORY } from '@events/domain/ports'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { getQueueToken } from '@nestjs/bullmq'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { ConfirmPhotoBatchCommand } from '@photos/application/commands/confirm-photo-batch/confirm-photo-batch.command'
import { ConfirmPhotoBatchHandler } from '@photos/application/commands/confirm-photo-batch/confirm-photo-batch.handler'
import { PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import { PhotoWriteRepository } from '@photos/infrastructure/repositories/photo-write.repository'
import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AUTHORIZATION_SERVICE } from '@shared/authorization/domain/ports/authorization.service.port'
import { KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

describe('photo quota', () => {
  let module: TestingModule
  let prisma: PrismaService
  let confirmHandler: ConfirmPhotoBatchHandler
  let photoWriteRepo: PhotoWriteRepository

  let tenant: { id: string }
  let user: { id: string }
  let eventType: { id: number }
  const createdEventIds: string[] = []

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
        { provide: EVENT_READ_REPOSITORY, useClass: EventReadRepository },
        { provide: PHOTO_WRITE_REPOSITORY, useClass: PhotoWriteRepository },
        {
          provide: AUTHORIZATION_SERVICE,
          // Real conditional UPDATE is what's under test here, not the permission graph.
          useValue: {
            resolveEventScope: async () => EventScope.unrestricted(),
            assert: async () => undefined,
            can: async () => true,
          },
        },
        {
          provide: KV_STORAGE_ADAPTER,
          useValue: { writeBulk: async () => undefined },
        },
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
        { provide: getQueueToken('embedding-generation'), useValue: { addBulk: async () => [] } },
        { provide: getQueueToken('photo-classification'), useValue: { addBulk: async () => [] } },
        ConfirmPhotoBatchHandler,
      ],
    }).compile()

    prisma = module.get(PrismaService)
    confirmHandler = module.get(ConfirmPhotoBatchHandler)
    photoWriteRepo = module.get(PHOTO_WRITE_REPOSITORY)

    tenant = await prisma.tenant.create({
      data: { name: 'Quota Tenant', is_platform: false, event_quota: 10 },
    })
    user = await prisma.user.create({
      data: {
        email: `quota-${crypto.randomUUID()}@t.com`,
        password_hash: 'x',
        permission_template_id: (
          await prisma.permissionTemplate.findUniqueOrThrow({
            where: { key: 'tenant' },
          })
        ).id,
        tenant_id: tenant.id,
      },
    })
    eventType = await prisma.eventType.findFirstOrThrow()
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.photo.deleteMany({ where: { event_id: { in: createdEventIds } } })
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
      await prisma.user.deleteMany({ where: { id: user?.id } })
      await prisma.tenant.deleteMany({ where: { id: tenant?.id } })
      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  async function createEvent(photoQuota: number | null, photosUploaded: number): Promise<string> {
    const event = await prisma.event.create({
      data: {
        name: 'Quota Event',
        slug: `quota-event-${crypto.randomUUID()}`,
        start_date: new Date('2026-09-01'),
        end_date: new Date('2026-09-02'),
        event_type_id: eventType.id,
        tenant_id: tenant.id,
        photo_quota: photoQuota,
        photos_uploaded: photosUploaded,
      },
    })
    createdEventIds.push(event.id)
    return event.id
  }

  function confirmBatch(eventId: string, count: number) {
    const photos = Array.from({ length: count }, () => {
      const key = crypto.randomUUID()
      return {
        fileName: `IMG_${key}.jpg`,
        fileSize: 1024,
        objectKey: `events/${eventId}/${key}-IMG.jpg`,
        contentType: 'image/jpeg',
      }
    })
    return confirmHandler.execute(
      new ConfirmPhotoBatchCommand(eventId, photos, new AuditContext(user.id)),
    )
  }

  it('never lets concurrent batches push photos_uploaded past the quota', async () => {
    // 8 used of 10: each batch of 2 fits alone (8+2=10), but both together would need 12.
    const eventId = await createEvent(10, 8)

    const results = await Promise.allSettled([confirmBatch(eventId, 2), confirmBatch(eventId, 2)])

    const succeeded = results.filter((r) => r.status === 'fulfilled')
    expect(succeeded).toHaveLength(1)

    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    expect(event.photos_uploaded).toBeLessThanOrEqual(10)
  })

  it('does not refund quota when photos are deleted', async () => {
    const eventId = await createEvent(3, 0)
    await confirmBatch(eventId, 3)

    const photos = await prisma.photo.findMany({ where: { event_id: eventId } })
    // Delete through the production repository so a future decrement added there would fail this test.
    for (const photo of photos) await photoWriteRepo.delete(photo.id)

    await expect(confirmBatch(eventId, 1)).rejects.toMatchObject({
      messageKey: 'event.photo_quota_exceeded',
    })
  })
})
