import { Prisma } from '@generated/prisma/client'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { countActivePermissionGrantHolders } from './count-active-permission-grant-holders'

/**
 * Runs the real SQL against the dev database, because a unit test that mocks `$queryRaw` returns a
 * canned value whatever SQL is sent — reverting to a template-only query would leave it green.
 *
 * Assertions here are relative (baseline + 1), so a parallel test file mutating the same global
 * holder population would break them. Everything runs in one `RepeatableRead` transaction: an
 * ambient holder becomes a constant offset that cancels out, and the throwaway users are created
 * and deleted inside it, so no cleanup is needed.
 */
describe('countActivePermissionGrantHolders', () => {
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

  it('counts a direct-grant holder that template-only counting would miss, and a deny grant overrides template membership', async () => {
    const platformTenant = await prisma.tenant.findFirstOrThrow({ where: { is_platform: true } })
    const grantPermission = await prisma.permission.findUniqueOrThrow({
      where: { key: 'permission.grant' },
    })
    const platformAdminTemplate = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'platform_admin' },
    })
    const issuer = await prisma.user.findFirstOrThrow({
      where: { tenant: { is_platform: true } },
    })

    const { baseline, afterGrant, afterDeny, excludingDirectHolder } = await prisma.$transaction(
      async (tx) => {
        const baseline = await countActivePermissionGrantHolders(tx)

        // Direct-grant-only holder: no template, a global allow grant. A template-only query
        // would miss this user entirely.
        const directGrantHolder = await tx.user.create({
          data: {
            email: `tit38-ruling4-grant-${Date.now()}@example.test`,
            password_hash: 'x',
            is_active: true,
            tenant_id: platformTenant.id,
            permission_grants: {
              create: {
                permission_id: grantPermission.id,
                scope_type: 'global',
                effect: 'allow',
                granted_by_id: issuer.id,
              },
            },
          },
        })

        const afterGrant = await countActivePermissionGrantHolders(tx)

        // Grant beats template, so this user must not be counted despite holding the key.
        const deniedTemplateHolder = await tx.user.create({
          data: {
            email: `tit38-ruling4-deny-${Date.now()}@example.test`,
            password_hash: 'x',
            is_active: true,
            tenant_id: platformTenant.id,
            permission_template_id: platformAdminTemplate.id,
            permission_grants: {
              create: {
                permission_id: grantPermission.id,
                scope_type: 'global',
                effect: 'deny',
                granted_by_id: issuer.id,
              },
            },
          },
        })

        const afterDeny = await countActivePermissionGrantHolders(tx)

        // excludeUserId removes exactly the direct-grant holder from the count.
        const excludingDirectHolder = await countActivePermissionGrantHolders(
          tx,
          directGrantHolder.id,
        )

        // Deleted inside the same transaction — nothing outlives this test, on any connection.
        await tx.user.delete({ where: { id: directGrantHolder.id } })
        await tx.user.delete({ where: { id: deniedTemplateHolder.id } })

        return { baseline, afterGrant, afterDeny, excludingDirectHolder }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )

    expect(afterGrant).toBe(baseline + 1)
    expect(afterDeny).toBe(afterGrant)
    expect(excludingDirectHolder).toBe(afterDeny - 1)
  })
})
