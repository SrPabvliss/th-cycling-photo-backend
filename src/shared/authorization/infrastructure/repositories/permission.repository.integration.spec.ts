import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PermissionRepository } from '@shared/authorization/infrastructure/repositories/permission.repository'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'

// Real-database integration test (not mocked): verifies PermissionRepository
// loads a principal's templates, grants, tenant and collaborator events from
// the real schema. `PrismaService` requires a `ConfigService` to build its
// connection string, so it is resolved through a TestingModule instead of
// being constructed bare — same pattern as tenant-backfill.integration.spec.ts
// and catalog-drift.integration.spec.ts.
describe('PermissionRepository', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: PermissionRepository

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
    repo = new PermissionRepository(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await module.close()
  })

  it('loads template permissions for a platform admin', async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { permission_template: { key: 'platform_admin' } },
    })
    const p = await repo.load(admin.id)
    expect(p.isPlatform).toBe(true)
    expect(p.templateKeys.has('buyer.read')).toBe(true)
  })

  it('reports a buyer as non-platform with no tenant', async () => {
    const buyer = await prisma.user.findFirstOrThrow({
      where: { permission_template: { key: 'customer' } },
    })
    const p = await repo.load(buyer.id)
    expect(p.isPlatform).toBe(false)
    expect(p.tenantId).toBeNull()
    expect(p.templateKeys.has('buyer.read')).toBe(false)
  })

  it('returns an empty principal for an unknown user rather than throwing', async () => {
    const p = await repo.load('00000000-0000-0000-0000-000000000000')
    expect(p.templateKeys.size).toBe(0)
    expect(p.isPlatform).toBe(false)
  })
})
