import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { TENANT_REPOSITORY } from '@tenants/domain/ports/tenant-repository.port'
import { TenantRepository } from '@tenants/infrastructure/repositories/tenant.repository'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

describe('tenant quota', () => {
  let module: TestingModule
  let prisma: PrismaService
  let tenantRepo: TenantRepository

  let eventType: { id: number }
  const createdTenantIds: string[] = []
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
      providers: [PrismaService, { provide: TENANT_REPOSITORY, useClass: TenantRepository }],
    }).compile()

    prisma = module.get(PrismaService)
    tenantRepo = module.get(TENANT_REPOSITORY)
    eventType = await prisma.eventType.findFirstOrThrow()
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
      await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } })
      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  async function createTenant(eventQuota: number): Promise<string> {
    const tenant = await prisma.tenant.create({
      data: { name: 'Quota Tenant', is_platform: false, event_quota: eventQuota },
    })
    createdTenantIds.push(tenant.id)
    return tenant.id
  }

  async function createEvent(tenantId: string, photosUploaded: number): Promise<string> {
    const event = await prisma.event.create({
      data: {
        name: 'Quota Event',
        slug: `quota-event-${crypto.randomUUID()}`,
        start_date: new Date('2026-09-01'),
        end_date: new Date('2026-09-02'),
        event_type_id: eventType.id,
        tenant_id: tenantId,
        photos_uploaded: photosUploaded,
      },
    })
    createdEventIds.push(event.id)
    return event.id
  }

  it('refunds an event slot only when the deleted event never had uploads', async () => {
    const tenantId = await createTenant(2)
    const untouched = await createEvent(tenantId, 0)
    const used = await createEvent(tenantId, 5)

    await prisma.event.updateMany({
      where: { id: { in: [untouched, used] } },
      data: { deleted_at: new Date() },
    })

    const result = await tenantRepo.checkQuota(tenantId)
    expect(result.used).toBe(1)
  })
})
