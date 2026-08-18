import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

/**
 * Real-database integration test (not mocked): a self-defending regression
 * test for the `user_permission_grants_unique` index's `NULLS NOT
 * DISTINCT` clause (TIT-38 Task 13 fix report item 2).
 *
 * Task 4 verified this by hand, once, with raw `psql` inside a manual
 * `BEGIN`/`ROLLBACK` — useful evidence at the time, but nothing that runs
 * again. `schema.prisma`'s `@@unique` on `UserPermissionGrant` (added by
 * Task 13, for `GrantPermissionHandler`'s `upsert`) cannot express `NULLS
 * NOT DISTINCT` — see the comment on that line — so it silently
 * understates what the real index enforces. If a future `prisma migrate
 * dev` ever "fixed" that apparent drift by recreating the index without
 * the clause, nothing would catch it except this test: two global grants
 * for the same (user, permission) would stop colliding, and
 * `PermissionRepository`/`countActivePermissionGrantHolders` would start
 * reading two conflicting effects for the same key with no defined
 * winner.
 *
 * Everything happens inside one Prisma interactive transaction, which
 * automatically rolls back when the callback throws — including the temp
 * user created at its start — so this leaves the dev database exactly as
 * it found it, on both a pass and a failure. Same ConfigModule +
 * real-service pattern as the sibling integration specs in this
 * directory; the transaction-rollback technique itself mirrors Task 4's
 * manual `psql` verification, just automated.
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

        // Second grant: identical (user_id, permission_id, scope_type:
        // 'global', event_id: null). Without NULLS NOT DISTINCT, Postgres
        // treats the two NULL event_ids as distinct and would allow both
        // rows — this must fail.
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
    // The failing second insert aborts the whole transaction, including
    // the temp user created at its start — confirms no residue, on top of
    // Prisma's documented automatic-rollback-on-throw behavior.
    const survivingUser = await prisma.user.findUnique({ where: { id: tempUserId } })
    expect(survivingUser).toBeNull()
  })
})
