import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../../config/configuration'
import { validate } from '../../../../../config/env.validation'
import { ApplyTemplateCommand } from './apply-template.command'
import { ApplyTemplateHandler } from './apply-template.handler'

/**
 * Proves `ApplyTemplateHandler`'s last-holder guard runs its `$transaction` correctly against
 * Postgres and commits a safe swap: a throwaway user holding `permission.grant` only through
 * `platform_admin` moves to `tenant`, which is safe because the seeded break-glass account remains.
 *
 * The reject path isn't exercised here — a genuine "zero holders left" scenario would mean mutating
 * that break-glass account. It is covered by a mock in apply-template.handler.spec.ts, and the SQL
 * itself by count-active-permission-grant-holders.integration.spec.ts.
 */
describe('ApplyTemplateHandler (real database)', () => {
  let module: TestingModule
  let prisma: PrismaService
  let userId: string

  const cache = { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() }

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

    const platformTenant = await prisma.tenant.findFirstOrThrow({ where: { is_platform: true } })
    const platformAdminTemplate = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'platform_admin' },
    })
    const user = await prisma.user.create({
      data: {
        email: `tit38-apply-template-${Date.now()}@example.test`,
        password_hash: 'x',
        is_active: true,
        tenant_id: platformTenant.id,
        permission_template_id: platformAdminTemplate.id,
      },
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
    await module.close()
  })

  it('swaps a platform_admin holder onto tenant when another holder remains, and persists it', async () => {
    const handler = new ApplyTemplateHandler(prisma, cache as never)

    await handler.execute(new ApplyTemplateCommand(userId, 'tenant', 'admin1'))

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { permission_template: { select: { key: true } }, permissions_version: true },
    })
    expect(updated.permission_template?.key).toBe('tenant')
    expect(updated.permissions_version).toBe(1)
    expect(cache.invalidate).toHaveBeenCalledWith(userId)
  })
})
