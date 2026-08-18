import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PERMISSIONS } from '@shared/authorization/domain/permission-catalog'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

// Real-database integration test (not mocked): verifies the `permissions`
// table seeded from PERMISSIONS matches the constant exactly, in both
// directions. `PrismaService` requires a `ConfigService` to build its
// connection string, so it is resolved through a TestingModule instead of
// being constructed bare — same pattern as tenant-backfill.integration.spec.ts
// and backblaze-b2.adapter.integration.spec.ts.
describe('catalog drift', () => {
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

  it('table matches the constant exactly', async () => {
    const rows = await prisma.permission.findMany({ select: { key: true } })
    expect(rows.map((r) => r.key).sort()).toEqual(Object.keys(PERMISSIONS).sort())
  })
})
