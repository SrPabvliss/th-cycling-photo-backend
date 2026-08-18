import { AppException } from '@shared/domain'
import { RevokePermissionCommand } from './revoke-permission.command'
import { RevokePermissionHandler } from './revoke-permission.handler'

describe('RevokePermissionHandler', () => {
  const cache = { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() }

  // Note: the brief's fixture only mocked `user.findUnique`, but the given
  // handler body also calls `user.update` (unconditionally, to bump
  // `permissions_version`) after every successful revoke — including in
  // the "allows the revoke" case below. `update` is added here so that
  // path doesn't throw `TypeError: ... update is not a function`; the
  // "bumps permissions_version" test still overrides it with its own
  // fresh mock to make its assertion.
  const prismaWith = (holders: number, targetProtected = false) => ({
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', is_protected: targetProtected }),
      update: jest.fn(),
    },
    userPermissionGrant: { deleteMany: jest.fn(), count: jest.fn().mockResolvedValue(holders) },
    $queryRaw: jest.fn().mockResolvedValue([{ count: BigInt(holders) }]),
  })

  it('refuses to revoke permission.grant from the last holder', async () => {
    const handler = new RevokePermissionHandler(prismaWith(1) as never, cache as never)
    await expect(
      handler.execute(new RevokePermissionCommand('u1', 'permission.grant', 'admin1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('allows the revoke when another holder remains', async () => {
    const prisma = prismaWith(2)
    const handler = new RevokePermissionHandler(prisma as never, cache as never)
    await handler.execute(new RevokePermissionCommand('u1', 'permission.grant', 'admin1'))
    expect(prisma.userPermissionGrant.deleteMany).toHaveBeenCalled()
  })

  it('refuses any change to a protected account', async () => {
    const handler = new RevokePermissionHandler(prismaWith(5, true) as never, cache as never)
    await expect(
      handler.execute(new RevokePermissionCommand('u1', 'event.update', 'admin1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('bumps permissions_version so the future Redis cache invalidates', async () => {
    const prisma = prismaWith(2)
    // biome-ignore lint/suspicious/noExplicitAny: partial mock
    ;(prisma as any).user.update = jest.fn()
    const handler = new RevokePermissionHandler(prisma as never, cache as never)
    await handler.execute(new RevokePermissionCommand('u1', 'event.update', 'admin1'))
    // biome-ignore lint/suspicious/noExplicitAny: partial mock
    expect((prisma as any).user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { permissions_version: { increment: 1 } } }),
    )
  })

  // Ruling 13: the command's `eventId` presence and `scopeType` must agree.
  // PermissionRepository silently mishandles both malformed shapes, so the
  // only writer (this handler) must reject them before touching the DB.
  describe('Ruling 13 — scope/event pairing', () => {
    it('rejects scope_type "event" with no eventId', async () => {
      const prisma = prismaWith(2)
      // biome-ignore lint/suspicious/noExplicitAny: partial mock
      ;(prisma as any).user.update = jest.fn()
      const handler = new RevokePermissionHandler(prisma as never, cache as never)
      await expect(
        handler.execute(new RevokePermissionCommand('u1', 'event.update', 'admin1', 'event')),
      ).rejects.toBeInstanceOf(AppException)
      expect(prisma.userPermissionGrant.deleteMany).not.toHaveBeenCalled()
    })

    it('rejects scope_type "global" with an eventId set', async () => {
      const prisma = prismaWith(2)
      // biome-ignore lint/suspicious/noExplicitAny: partial mock
      ;(prisma as any).user.update = jest.fn()
      const handler = new RevokePermissionHandler(prisma as never, cache as never)
      await expect(
        handler.execute(
          new RevokePermissionCommand('u1', 'event.update', 'admin1', 'global', 'event-1'),
        ),
      ).rejects.toBeInstanceOf(AppException)
      expect(prisma.userPermissionGrant.deleteMany).not.toHaveBeenCalled()
    })

    it('accepts a well-formed event-scoped revoke and deletes the matching row', async () => {
      const prisma = prismaWith(2)
      // biome-ignore lint/suspicious/noExplicitAny: partial mock
      ;(prisma as any).user.update = jest.fn()
      const handler = new RevokePermissionHandler(prisma as never, cache as never)
      await handler.execute(
        new RevokePermissionCommand('u1', 'event.update', 'admin1', 'event', 'event-1'),
      )
      expect(prisma.userPermissionGrant.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ scope_type: 'event', event_id: 'event-1' }),
        }),
      )
    })
  })
})
