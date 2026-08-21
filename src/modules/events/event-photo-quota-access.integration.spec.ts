import { GetEventDetailHandler } from '@events/application/queries/get-event-detail/get-event-detail.handler'
import { GetEventDetailQuery } from '@events/application/queries/get-event-detail/get-event-detail.query'
import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { EVENT_READ_REPOSITORY } from '@events/domain/ports'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { getQueueToken } from '@nestjs/bullmq'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { ConfirmPhotoBatchCommand } from '@photos/application/commands/confirm-photo-batch/confirm-photo-batch.command'
import { ConfirmPhotoBatchHandler } from '@photos/application/commands/confirm-photo-batch/confirm-photo-batch.handler'
import { PHOTO_READ_REPOSITORY, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import { PhotoWriteRepository } from '@photos/infrastructure/repositories/photo-write.repository'
import { AuditContext } from '@shared/application'
import { AUTHORIZATION_SERVICE } from '@shared/authorization/domain/ports/authorization.service.port'
import { AUTHORIZATION_CACHE } from '@shared/authorization/domain/ports/authorization-cache.port'
import { PERMISSION_REPOSITORY } from '@shared/authorization/domain/ports/permission-repository.port'
import { AuthorizationService } from '@shared/authorization/infrastructure/authorization.service'
import { RequestScopedAuthorizationCache } from '@shared/authorization/infrastructure/cache/request-scoped-authorization.cache'
import { PermissionRepository } from '@shared/authorization/infrastructure/repositories/permission.repository'
import { KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

describe('event photo quota access', () => {
  let module: TestingModule
  let prisma: PrismaService
  let confirmHandler: ConfirmPhotoBatchHandler
  let getDetail: GetEventDetailHandler

  let tenantA: { id: string }
  let tenantB: { id: string }
  let userA: { id: string }
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
        { provide: PERMISSION_REPOSITORY, useClass: PermissionRepository },
        { provide: AUTHORIZATION_CACHE, useClass: RequestScopedAuthorizationCache },
        AuthorizationService,
        // Real scope resolution + grant checks is exactly what this suite is verifying.
        { provide: AUTHORIZATION_SERVICE, useExisting: AuthorizationService },
        { provide: EVENT_READ_REPOSITORY, useClass: EventReadRepository },
        { provide: PHOTO_WRITE_REPOSITORY, useClass: PhotoWriteRepository },
        {
          provide: PHOTO_READ_REPOSITORY,
          useValue: {
            getTotalFileSizeByEvent: async () => 0,
            getClassifiedCountByEvent: async () => 0,
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
        FreezeStateService,
        ConfirmPhotoBatchHandler,
        GetEventDetailHandler,
      ],
    }).compile()

    prisma = module.get(PrismaService)
    confirmHandler = module.get(ConfirmPhotoBatchHandler)
    getDetail = module.get(GetEventDetailHandler)

    const tenantTpl = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'tenant' },
    })

    tenantA = await prisma.tenant.create({
      data: { name: 'Quota Access Tenant A', is_platform: false, event_quota: 10 },
    })
    tenantB = await prisma.tenant.create({
      data: { name: 'Quota Access Tenant B', is_platform: false, event_quota: 10 },
    })
    userA = await prisma.user.create({
      data: {
        email: `quota-access-a-${crypto.randomUUID()}@t.com`,
        password_hash: 'x',
        permission_template_id: tenantTpl.id,
        tenant_id: tenantA.id,
      },
    })
    eventType = await prisma.eventType.findFirstOrThrow()
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.photo.deleteMany({ where: { event_id: { in: createdEventIds } } })
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
      await prisma.user.deleteMany({ where: { id: userA?.id } })
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA?.id, tenantB?.id] } } })
      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  async function createTenantBEvent(): Promise<string> {
    const event = await prisma.event.create({
      data: {
        name: 'Tenant B Quota Event',
        slug: `quota-access-b-${crypto.randomUUID()}`,
        start_date: new Date('2026-09-01'),
        end_date: new Date('2026-09-02'),
        event_type_id: eventType.id,
        tenant_id: tenantB.id,
        photo_quota: 5,
        photos_uploaded: 1,
      },
    })
    createdEventIds.push(event.id)
    return event.id
  }

  it('rejects a foreign tenant photo batch as not found and leaves the quota counter untouched', async () => {
    const eventId = await createTenantBEvent()

    await expect(
      confirmHandler.execute(
        new ConfirmPhotoBatchCommand(
          eventId,
          [
            {
              fileName: 'IMG_1.jpg',
              fileSize: 1024,
              objectKey: `events/${eventId}/${crypto.randomUUID()}-IMG.jpg`,
              contentType: 'image/jpeg',
            },
          ],
          new AuditContext(userA.id),
        ),
      ),
    ).rejects.toMatchObject({ httpStatus: 404, code: 'NOT_FOUND' })

    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    expect(event.photos_uploaded).toBe(1)
  })

  it('hides a foreign tenant event detail — and its quota fields — behind not found', async () => {
    const eventId = await createTenantBEvent()
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })

    await expect(
      getDetail.execute(new GetEventDetailQuery(event.slug, userA.id)),
    ).rejects.toMatchObject({ httpStatus: 404, code: 'NOT_FOUND' })
  })
})
