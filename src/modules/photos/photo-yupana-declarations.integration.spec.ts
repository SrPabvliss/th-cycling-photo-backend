import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { EVENT_READ_REPOSITORY } from '@events/domain/ports'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { YupanaOutboxKind } from '@generated/prisma/client'
import { getQueueToken } from '@nestjs/bullmq'
import { ConfigModule } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test, type TestingModule } from '@nestjs/testing'
import { ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { ConfirmPhotoBatchCommand } from '@photos/application/commands/confirm-photo-batch/confirm-photo-batch.command'
import { ConfirmPhotoBatchHandler } from '@photos/application/commands/confirm-photo-batch/confirm-photo-batch.handler'
import { ConfirmRetouchedUploadCommand } from '@photos/application/commands/confirm-retouched-upload/confirm-retouched-upload.command'
import { ConfirmRetouchedUploadHandler } from '@photos/application/commands/confirm-retouched-upload/confirm-retouched-upload.handler'
import { DeletePhotoCommand } from '@photos/application/commands/delete-photo/delete-photo.command'
import { DeletePhotoHandler } from '@photos/application/commands/delete-photo/delete-photo.handler'
import { PHOTO_READ_REPOSITORY, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import * as PhotoMapper from '@photos/infrastructure/mappers/photo.mapper'
import { PhotoWriteRepository } from '@photos/infrastructure/repositories/photo-write.repository'
import { PREVIEW_LINK_READ_REPOSITORY } from '@previews/domain/ports'
import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AUTHORIZATION_SERVICE } from '@shared/authorization/domain/ports/authorization.service.port'
import { KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import {
  CDN_RETIRED_SLUG_REPOSITORY,
  YUPANA_OUTBOX_REPOSITORY,
  YUPANA_PHOTO_DECLARER,
} from '@shared/yupana/domain/ports'
import { CdnRetiredSlugRepository } from '@shared/yupana/infrastructure/repositories/cdn-retired-slug.repository'
import { YupanaOutboxRepository } from '@shared/yupana/infrastructure/repositories/yupana-outbox.repository'
import { YupanaPhotoDeclarerService } from '@shared/yupana/infrastructure/services/yupana-photo-declarer.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

describe('photo size declarations for yupana', () => {
  let module: TestingModule
  let prisma: PrismaService
  let bucket: string

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
          provide: PHOTO_READ_REPOSITORY,
          inject: [PrismaService],
          useFactory: (prismaService: PrismaService) => ({
            findByIdInScope: async (id: string) => {
              const row = await prismaService.photo.findUnique({ where: { id } })
              return row ? PhotoMapper.toEntity(row) : null
            },
          }),
        },
        { provide: YUPANA_OUTBOX_REPOSITORY, useClass: YupanaOutboxRepository },
        { provide: YUPANA_PHOTO_DECLARER, useClass: YupanaPhotoDeclarerService },
        { provide: CDN_RETIRED_SLUG_REPOSITORY, useClass: CdnRetiredSlugRepository },
        {
          provide: AUTHORIZATION_SERVICE,
          useValue: {
            resolveEventScope: async () => EventScope.unrestricted(),
            assert: async () => undefined,
            can: async () => true,
          },
        },
        {
          provide: KV_STORAGE_ADAPTER,
          useValue: {
            writeBulk: async () => undefined,
            write: async () => undefined,
            delete: async () => undefined,
          },
        },
        { provide: STORAGE_ADAPTER, useValue: { delete: async () => undefined } },
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
        {
          provide: ORDER_READ_REPOSITORY,
          useValue: {
            existsByPhotoId: async () => false,
            findOrdersFullyRetouchedByPhoto: async () => [],
          },
        },
        { provide: PREVIEW_LINK_READ_REPOSITORY, useValue: { existsByPhotoId: async () => false } },
        { provide: EventEmitter2, useValue: { emit: () => true } },
        { provide: getQueueToken('photo-classification'), useValue: { addBulk: async () => [] } },
        FreezeStateService,
        ConfirmPhotoBatchHandler,
        ConfirmRetouchedUploadHandler,
        DeletePhotoHandler,
      ],
    }).compile()

    prisma = module.get(PrismaService)
    bucket = configuration().storage.b2.bucketName ?? ''

    tenant = await prisma.tenant.create({
      data: { name: 'Yupana Declarations Tenant', is_platform: false, event_quota: 10 },
    })
    user = await prisma.user.create({
      data: {
        email: `yupana-${crypto.randomUUID()}@t.com`,
        password_hash: 'x',
        permission_template_id: (
          await prisma.permissionTemplate.findUniqueOrThrow({ where: { key: 'tenant' } })
        ).id,
        tenant_id: tenant.id,
      },
    })
    eventType = await prisma.eventType.findFirstOrThrow()
  })

  afterAll(async () => {
    if (prisma) {
      if (createdEventIds.length > 0) {
        await prisma.yupanaOutboxItem.deleteMany({
          where: {
            OR: createdEventIds.map((id) => ({
              payload: { path: ['domain_event_id'], equals: id },
            })),
          },
        })
      }
      await prisma.photo.deleteMany({ where: { event_id: { in: createdEventIds } } })
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
      await prisma.user.deleteMany({ where: { id: user?.id } })
      await prisma.tenant.deleteMany({ where: { id: tenant?.id } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  async function createEvent(): Promise<string> {
    const event = await prisma.event.create({
      data: {
        name: 'Yupana Declarations Event',
        slug: `yupana-declarations-${crypto.randomUUID()}`,
        start_date: new Date('2026-09-01'),
        end_date: new Date('2026-09-02'),
        event_type_id: eventType.id,
        tenant_id: tenant.id,
        photo_quota: 100,
        photos_uploaded: 0,
      },
    })
    createdEventIds.push(event.id)
    return event.id
  }

  function photoItem(eventId: string, fileSize: number) {
    const key = crypto.randomUUID()
    return {
      fileName: `IMG_${key}.jpg`,
      fileSize,
      objectKey: `events/${eventId}/${key}-IMG.jpg`,
      contentType: 'image/jpeg',
    }
  }

  function confirm(eventId: string, photos: ReturnType<typeof photoItem>[]) {
    return module
      .get(ConfirmPhotoBatchHandler)
      .execute(new ConfirmPhotoBatchCommand(eventId, photos, new AuditContext(user.id)))
  }

  async function declarationsOf(photoId: string) {
    const items = await prisma.yupanaOutboxItem.findMany({
      where: { photo_id: photoId, kind: YupanaOutboxKind.photo_declaration },
      orderBy: { created_at: 'asc' },
    })
    return items.map((item) => item.payload as Record<string, unknown>)
  }

  async function photoIdOf(objectKey: string): Promise<string> {
    const row = await prisma.photo.findUniqueOrThrow({ where: { storage_key: objectKey } })
    return row.id
  }

  it('declares every confirmed photo with its size and the bucket', async () => {
    const eventId = await createEvent()
    const items = [photoItem(eventId, 1024), photoItem(eventId, 2048)]

    await confirm(eventId, items)

    for (const item of items) {
      const declarations = await declarationsOf(await photoIdOf(item.objectKey))
      expect(declarations).toHaveLength(1)
      expect(declarations[0]).toMatchObject({
        domain_event_id: eventId,
        bucket,
        bytes: item.fileSize,
      })
      expect(declarations[0].stored_until).toBeUndefined()
    }
  })

  it('declares only the photos a retried batch actually inserted', async () => {
    const eventId = await createEvent()
    const first = photoItem(eventId, 1024)
    await confirm(eventId, [first])

    const second = photoItem(eventId, 4096)
    await confirm(eventId, [first, second])

    expect(await declarationsOf(await photoIdOf(first.objectKey))).toHaveLength(1)
    expect(await declarationsOf(await photoIdOf(second.objectKey))).toHaveLength(1)
  })

  it('declares the original plus the retouched size after a retouch', async () => {
    const eventId = await createEvent()
    const item = photoItem(eventId, 1024)
    await confirm(eventId, [item])
    const photoId = await photoIdOf(item.objectKey)

    await module
      .get(ConfirmRetouchedUploadHandler)
      .execute(
        new ConfirmRetouchedUploadCommand(
          photoId,
          `events/${eventId}/retouched/${crypto.randomUUID()}.jpg`,
          500,
          user.id,
        ),
      )

    const declarations = await declarationsOf(photoId)
    expect(declarations).toHaveLength(2)
    expect(declarations[1]).toMatchObject({ bytes: 1524 })
    expect(declarations[1].stored_from).toBe(declarations[0].stored_from)
  })

  it('declares the end of storage when a declared photo is deleted', async () => {
    const eventId = await createEvent()
    const item = photoItem(eventId, 1024)
    await confirm(eventId, [item])
    const photoId = await photoIdOf(item.objectKey)

    await module.get(DeletePhotoHandler).execute(new DeletePhotoCommand(photoId, user.id))

    const declarations = await declarationsOf(photoId)
    expect(declarations).toHaveLength(2)
    expect(declarations[1]).toMatchObject({ bytes: 1024 })
    expect(declarations[1].stored_until).toBe(declarations[1].declared_at)
  })

  it('declares nothing when deleting a photo that was never declared', async () => {
    const eventId = await createEvent()
    const item = photoItem(eventId, 1024)
    await confirm(eventId, [item])
    const photoId = await photoIdOf(item.objectKey)
    await prisma.yupanaOutboxItem.deleteMany({ where: { photo_id: photoId } })

    await module.get(DeletePhotoHandler).execute(new DeletePhotoCommand(photoId, user.id))

    expect(await declarationsOf(photoId)).toHaveLength(0)
  })
})
