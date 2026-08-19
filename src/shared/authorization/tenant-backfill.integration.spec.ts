import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

// Verifies the tenant backfill migration actually ran against the dev database. `PrismaService`
// needs a `ConfigService` for its connection string, hence the TestingModule.
describe('tenant backfill', () => {
  let module: TestingModule
  let prisma: PrismaService

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
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await module.close()
  })

  it('creates exactly one platform tenant', async () => {
    const platforms = await prisma.tenant.findMany({ where: { is_platform: true } })
    expect(platforms).toHaveLength(1)
  })

  it('assigns every event to a tenant', async () => {
    const orphans = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM events WHERE tenant_id IS NULL`
    expect(Number(orphans[0].count)).toBe(0)
  })

  it('rejects a second platform tenant', async () => {
    await expect(
      prisma.tenant.create({ data: { name: 'Impostor', is_platform: true } }),
    ).rejects.toThrow()
  })
})
