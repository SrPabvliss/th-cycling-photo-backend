import { AppException } from '@shared/domain'
import { GrantPermissionCommand } from './grant-permission.command'
import { GrantPermissionHandler } from './grant-permission.handler'

describe('GrantPermissionHandler', () => {
  const cache = { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() }

  const prismaWith = (isPlatform: boolean, platformOnly: boolean, isProtected = false) => ({
    permission: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', is_platform_only: platformOnly }),
    },
    user: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ is_protected: isProtected, tenant: { is_platform: isPlatform } }),
      update: jest.fn(),
    },
    // `findFirst` is the null-aware lookup the handler uses in place of the compound unique key.
    // Defaults to "no existing row" (create path); tests override it for the update path.
    userPermissionGrant: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
  })

  it('refuses to grant a platform-only permission to a tenant user', async () => {
    const handler = new GrantPermissionHandler(prismaWith(false, true) as never, cache as never)
    await expect(
      handler.execute(new GrantPermissionCommand('u1', 'buyer.read', 'allow', 'admin1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('allows a platform-only permission for a platform user', async () => {
    const prisma = prismaWith(true, true)
    const handler = new GrantPermissionHandler(prisma as never, cache as never)
    await handler.execute(new GrantPermissionCommand('u1', 'buyer.read', 'allow', 'admin1'))
    expect(prisma.userPermissionGrant.upsert).toHaveBeenCalled()
  })

  it('refuses any grant against a protected account', async () => {
    const handler = new GrantPermissionHandler(
      prismaWith(true, false, true) as never,
      cache as never,
    )
    await expect(
      handler.execute(new GrantPermissionCommand('u1', 'event.update', 'allow', 'admin1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('bumps permissions_version and invalidates the cache', async () => {
    const prisma = prismaWith(true, false)
    const handler = new GrantPermissionHandler(prisma as never, cache as never)
    await handler.execute(new GrantPermissionCommand('u1', 'event.update', 'allow', 'admin1'))
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { permissions_version: { increment: 1 } } }),
    )
    expect(cache.invalidate).toHaveBeenCalledWith('u1')
  })

  it('creates a new grant when none exists yet, keyed on a placeholder id', async () => {
    const prisma = prismaWith(true, false)
    const handler = new GrantPermissionHandler(prisma as never, cache as never)
    await handler.execute(new GrantPermissionCommand('u1', 'event.update', 'deny', 'admin1'))
    expect(prisma.userPermissionGrant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'u1', permission_id: 'p1', scope_type: 'global', event_id: null },
      }),
    )
    expect(prisma.userPermissionGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '00000000-0000-0000-0000-000000000000' },
        create: expect.objectContaining({
          user_id: 'u1',
          permission_id: 'p1',
          scope_type: 'global',
          event_id: null,
          effect: 'deny',
        }),
      }),
    )
  })

  it('re-granting an existing scope updates that row instead of creating a duplicate', async () => {
    const prisma = prismaWith(true, false)
    prisma.userPermissionGrant.findFirst.mockResolvedValue({ id: 'existing-grant-1' })
    const handler = new GrantPermissionHandler(prisma as never, cache as never)
    await handler.execute(new GrantPermissionCommand('u1', 'event.update', 'deny', 'admin1'))
    expect(prisma.userPermissionGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-grant-1' },
        update: expect.objectContaining({ effect: 'deny', granted_by_id: 'admin1' }),
      }),
    )
  })

  // `eventId` presence and `scopeType` must agree, enforced here as the only writer.
  describe('Ruling 13 — scope/event pairing', () => {
    it('rejects scope_type "event" with no eventId', async () => {
      const prisma = prismaWith(true, false)
      const handler = new GrantPermissionHandler(prisma as never, cache as never)
      await expect(
        handler.execute(
          new GrantPermissionCommand('u1', 'event.update', 'allow', 'admin1', 'event'),
        ),
      ).rejects.toBeInstanceOf(AppException)
      expect(prisma.userPermissionGrant.upsert).not.toHaveBeenCalled()
    })

    it('rejects scope_type "global" with an eventId set', async () => {
      const prisma = prismaWith(true, false)
      const handler = new GrantPermissionHandler(prisma as never, cache as never)
      await expect(
        handler.execute(
          new GrantPermissionCommand('u1', 'event.update', 'allow', 'admin1', 'global', 'event-1'),
        ),
      ).rejects.toBeInstanceOf(AppException)
      expect(prisma.userPermissionGrant.upsert).not.toHaveBeenCalled()
    })

    it('accepts a well-formed event-scoped grant', async () => {
      const prisma = prismaWith(true, false)
      const handler = new GrantPermissionHandler(prisma as never, cache as never)
      await handler.execute(
        new GrantPermissionCommand('u1', 'event.update', 'allow', 'admin1', 'event', 'event-1'),
      )
      expect(prisma.userPermissionGrant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'u1', permission_id: 'p1', scope_type: 'event', event_id: 'event-1' },
        }),
      )
      expect(prisma.userPermissionGrant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ scope_type: 'event', event_id: 'event-1' }),
        }),
      )
    })
  })
})
