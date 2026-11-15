import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PermissionRepository } from '@shared/authorization/infrastructure/repositories/permission.repository'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'

// Verifies PermissionRepository loads a principal's templates, grants, tenant and collaborator
// events from the real schema. `PrismaService` needs a `ConfigService`, hence the TestingModule.
describe('PermissionRepository', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: PermissionRepository
  let adminId: string
  let buyerId: string

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

    const platformTenant = await prisma.tenant.findFirstOrThrow({ where: { is_platform: true } })
    const adminTemplate = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'platform_admin' },
    })
    const customerTemplate = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'customer' },
    })
    const stamp = randomUUID()

    adminId = (
      await prisma.user.create({
        data: {
          email: `permission-repo-admin-${stamp}@example.com`,
          password_hash: 'x',
          tenant_id: platformTenant.id,
          permission_template_id: adminTemplate.id,
        },
      })
    ).id
    buyerId = (
      await prisma.user.create({
        data: {
          email: `permission-repo-buyer-${stamp}@example.com`,
          password_hash: 'x',
          tenant_id: null,
          permission_template_id: customerTemplate.id,
        },
      })
    ).id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [adminId, buyerId].filter(Boolean) } } })
    await prisma.$disconnect()
    await module.close()
  })

  it('loads template permissions for a platform admin', async () => {
    const p = await repo.load(adminId)
    expect(p.isPlatform).toBe(true)
    expect(p.templateKeys.has('buyer.read')).toBe(true)
  })

  it('reports a buyer as non-platform with no tenant', async () => {
    const p = await repo.load(buyerId)
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
