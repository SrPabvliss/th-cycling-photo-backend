import { randomUUID as uuid } from 'node:crypto'
import { GetPublicEventsListHandler } from '@events/application/queries/get-public-events-list/get-public-events-list.handler'
import { GetPublicEventsListQuery } from '@events/application/queries/get-public-events-list/get-public-events-list.query'
import { EVENT_READ_REPOSITORY } from '@events/domain/ports'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { Pagination } from '@shared/application'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../../config/configuration'
import { validate } from '../../../../../config/env.validation'

// The event carries its own snapshot of the public name, so the spec states it instead of reading
// whatever the platform tenant happens to be called in this database (it may have none).
const PLATFORM_PUBLIC_NAME = 'Titan TV Oficial'

describe('public owner legend', () => {
  let module: TestingModule
  let prisma: PrismaService
  let handler: GetPublicEventsListHandler

  let tenant: any
  let event: any
  let asset: any
  let platformTenant: any
  let platformEvent: any
  let platformAsset: any

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
        GetPublicEventsListHandler,
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
      ],
    }).compile()

    prisma = module.get(PrismaService)
    handler = module.get(GetPublicEventsListHandler)

    tenant = await prisma.tenant.create({
      data: { name: 'Foto Andes Studio', is_platform: false, public_name: 'Foto Andes' },
    })
    platformTenant = await prisma.tenant.findFirstOrThrow({ where: { is_platform: true } })

    const evtType = await prisma.eventType.findFirstOrThrow()

    event = await prisma.event.create({
      data: {
        name: 'Ruta Andes',
        slug: `ruta-andes-${uuid()}`,
        start_date: new Date(),
        end_date: new Date(),
        tenant_id: tenant.id,
        event_type_id: evtType.id,
        status: 'active',
        snap_public_name: 'Foto Andes',
      },
    })

    asset = await prisma.eventAsset.create({
      data: {
        event_id: event.id,
        asset_type: 'cover_image',
        storage_key: `cover-${uuid()}`,
        public_slug: uuid().substring(0, 20),
        file_size: 100,
      },
    })

    platformEvent = await prisma.event.create({
      data: {
        name: 'Ruta Platform',
        slug: `ruta-platform-${uuid()}`,
        start_date: new Date(),
        end_date: new Date(),
        tenant_id: platformTenant.id,
        event_type_id: evtType.id,
        status: 'active',
        snap_public_name: PLATFORM_PUBLIC_NAME,
      },
    })

    platformAsset = await prisma.eventAsset.create({
      data: {
        event_id: platformEvent.id,
        asset_type: 'cover_image',
        storage_key: `cover-${uuid()}`,
        public_slug: uuid().substring(0, 20),
        file_size: 100,
      },
    })
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.eventAsset.deleteMany({
        where: { id: { in: [asset?.id, platformAsset?.id].filter(Boolean) } },
      })
      await prisma.event.deleteMany({
        where: { id: { in: [event?.id, platformEvent?.id].filter(Boolean) } },
      })
      await prisma.tenant.deleteMany({ where: { id: { in: [tenant?.id].filter(Boolean) } } })
      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  it('shows the owning tenant on a public read, never the platform', async () => {
    const pagination = new Pagination(1, 50)
    const result = await handler.execute(
      new GetPublicEventsListQuery(pagination, {
        search: null,
        eventTypeId: null,
        hasPhotos: false,
      }),
    )
    const item = result.items.find((i) => i.slug === event.slug)
    const platformItem = result.items.find((i) => i.slug === platformEvent.slug)

    expect(item?.ownerName).toBe('Foto Andes')
    expect(item?.ownerName).not.toBe(PLATFORM_PUBLIC_NAME)
    expect(platformItem?.ownerName).toBe(PLATFORM_PUBLIC_NAME)
    expect(platformItem?.ownerName).not.toBe(item?.ownerName)
  })
})
