import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

/**
 * Guards the `NULLS NOT DISTINCT` clause on `user_permission_grants_unique`, which
 * `schema.prisma`'s `@@unique` cannot express and so silently understates. If a `prisma migrate
 * dev` ever "fixed" that apparent drift, two global grants for the same (user, permission) would
 * stop colliding and the authorization engine would read two conflicting effects with no winner.
 *
 * Runs inside a Prisma interactive transaction that rolls back when the callback throws, so the
 * dev database is left untouched on both a pass and a failure.
 */
describe('user_permission_grants NULLS NOT DISTINCT constraint', () => {
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

  it('rejects a second global grant for the same (user, permission) with event_id null', async () => {
    const grantPermission = await prisma.permission.findUniqueOrThrow({
      where: { key: 'permission.grant' },
    })
    let tempUserId: string | undefined

    await expect(
      prisma.$transaction(async (tx) => {
        const tempUser = await tx.user.create({
          data: {
            email: `tit38-constraint-${Date.now()}@example.test`,
            password_hash: 'x',
          },
        })
        tempUserId = tempUser.id

        await tx.userPermissionGrant.create({
          data: {
            user_id: tempUser.id,
            permission_id: grantPermission.id,
            scope_type: 'global',
            effect: 'allow',
            granted_by_id: tempUser.id,
          },
        })

        // Identical to the first. Without NULLS NOT DISTINCT, Postgres treats the two NULL
        // event_ids as distinct and allows both rows — this must fail.
        await tx.userPermissionGrant.create({
          data: {
            user_id: tempUser.id,
            permission_id: grantPermission.id,
            scope_type: 'global',
            effect: 'deny',
            granted_by_id: tempUser.id,
          },
        })
      }),
    ).rejects.toThrow(/Unique constraint/i)

    expect(tempUserId).toBeDefined()
    // The failing insert aborts the transaction, temp user included — confirms no residue.
    const survivingUser = await prisma.user.findUnique({ where: { id: tempUserId } })
    expect(survivingUser).toBeNull()
  })
})
