import { Prisma } from '@generated/prisma/client'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { countActivePermissionGrantHolders } from './count-active-permission-grant-holders'

/**
 * Real-database integration test (not mocked) for Ruling 4 (TIT-38 Task
 * 13): proves the last-holder query counts holders via a direct UBAC
 * grant, not just template membership, and that a deny grant overrides
 * template membership. A unit test that mocks `$queryRaw` wholesale
 * cannot catch a regression here — the mock returns a canned value no
 * matter what SQL is sent, so reverting the query to the brief's
 * template-only version would leave every unit test green. This test
 * exercises the real SQL against the seeded dev database, following the
 * same ConfigModule + real-service pattern as
 * permission.repository.integration.spec.ts.
 *
 * TIT-38 Task 13 fix report: this test's assertions are relative
 * (baseline + 1, afterDeny === afterGrant), which is exactly what makes
 * them vulnerable to another integration test file mutating the *same*
 * global holder population concurrently — Jest runs test files in
 * parallel by default, and e.g. apply-template.handler.integration.spec.ts
 * holds one extra real holder open for its `beforeAll`→`afterAll` window.
 * The whole sequence below runs inside one `RepeatableRead` transaction so
 * it sees a single consistent snapshot for its entire duration: an
 * ambient holder from another file, if present throughout that snapshot,
 * becomes a constant offset that cancels out in every relative assertion
 * here. The two throwaway users are also created *and* deleted inside
 * that same transaction, so nothing is visible to any other connection at
 * any point — no `afterAll` cleanup needed.
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

        // Direct-grant-only holder: no template, a global allow grant.
        // Ruling 4's whole point — the brief's template-only query would
        // not count this user at all.
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

        // Template holder with an explicit deny grant: grant beats
        // template, per AuthorizationService's own precedence, so this
        // user must NOT be counted even though their template includes
        // permission.grant.
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

        // Both temp users are deleted inside this same transaction, before
        // it commits — nothing outlives this test, on any connection.
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
