import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../../config/configuration'
import { validate } from '../../../../../config/env.validation'
import { GrantPermissionCommand } from './grant-permission.command'
import { GrantPermissionHandler } from './grant-permission.handler'

/**
 * Proves `GrantPermissionHandler`'s findFirst-then-upsert-by-id workaround works against the
 * physical `NULLS NOT DISTINCT` index. A unit test mocking `upsert` never exercises Prisma's real
 * compound-key limitation with a null `event_id`.
 */
describe('GrantPermissionHandler (real database)', () => {
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
    const user = await prisma.user.create({
      data: {
        email: `tit38-grant-handler-${Date.now()}@example.test`,
        password_hash: 'x',
        is_active: true,
        tenant_id: platformTenant.id,
      },
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
    await module.close()
  })

  it('creates a global grant, then re-granting updates the same row instead of duplicating it', async () => {
    const handler = new GrantPermissionHandler(prisma, cache as never)

    await handler.execute(new GrantPermissionCommand(userId, 'event.update', 'allow', userId))

    const afterCreate = await prisma.userPermissionGrant.findMany({ where: { user_id: userId } })
    expect(afterCreate).toHaveLength(1)
    expect(afterCreate[0]).toMatchObject({ scope_type: 'global', event_id: null, effect: 'allow' })

    await handler.execute(new GrantPermissionCommand(userId, 'event.update', 'deny', userId))

    const afterRegrant = await prisma.userPermissionGrant.findMany({ where: { user_id: userId } })
    expect(afterRegrant).toHaveLength(1)
    expect(afterRegrant[0].id).toBe(afterCreate[0].id)
    expect(afterRegrant[0].effect).toBe('deny')
  })
})
