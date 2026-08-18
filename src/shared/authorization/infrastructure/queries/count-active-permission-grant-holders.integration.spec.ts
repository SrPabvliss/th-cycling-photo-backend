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
 * Creates two throwaway platform-tenant users to prove the grant-vs-template
 * precedence, and deletes them (cascading their grants) in `afterAll`.
 */
describe('countActivePermissionGrantHolders', () => {
  let module: TestingModule
  let prisma: PrismaService
  const createdUserIds: string[] = []

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
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    }
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

    const baseline = await countActivePermissionGrantHolders(prisma)

    // Direct-grant-only holder: no template, a global allow grant. Ruling
    // 4's whole point — the brief's template-only query would not count
    // this user at all.
    const directGrantHolder = await prisma.user.create({
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
    createdUserIds.push(directGrantHolder.id)

    const afterGrant = await countActivePermissionGrantHolders(prisma)
    expect(afterGrant).toBe(baseline + 1)

    // Template holder with an explicit deny grant: grant beats template,
    // per AuthorizationService's own precedence, so this user must NOT be
    // counted even though their template includes permission.grant.
    const deniedTemplateHolder = await prisma.user.create({
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
    createdUserIds.push(deniedTemplateHolder.id)

    const afterDeny = await countActivePermissionGrantHolders(prisma)
    expect(afterDeny).toBe(afterGrant)

    // excludeUserId removes exactly the direct-grant holder from the count.
    const excludingDirectHolder = await countActivePermissionGrantHolders(
      prisma,
      directGrantHolder.id,
    )
    expect(excludingDirectHolder).toBe(afterDeny - 1)
  })
})
