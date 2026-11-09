import { AppException } from '@shared/domain'
import { ApplyTemplateCommand } from './apply-template.command'
import { ApplyTemplateHandler } from './apply-template.handler'

describe('ApplyTemplateHandler', () => {
  const cache = { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() }

  // `$transaction` invokes its callback with the mock itself as `tx`, so `tx.user.update` and
  // `tx.$queryRaw` inside the handler are the same jest mocks asserted on below. `holders` defaults
  // to 2 ("safe, not the last one") so tests that don't care about the guard aren't coupled to it.
  const prismaWith = (
    isPlatform: boolean,
    templatePlatformOnly: boolean,
    isProtected = false,
    holders = 2,
  ) => {
    // biome-ignore lint/suspicious/noExplicitAny: self-referential mock, see comment above
    const self: any = {
      permissionTemplate: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 't1', is_platform_only: templatePlatformOnly }),
      },
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ is_protected: isProtected, tenant: { is_platform: isPlatform } }),
        update: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ count: BigInt(holders) }]),
    }
    self.$transaction = jest.fn((cb: (tx: typeof self) => unknown) => cb(self))
    return self
  }

  it('refuses to apply a platform-only template to a tenant user', async () => {
    const handler = new ApplyTemplateHandler(prismaWith(false, true) as never, cache as never)
    await expect(
      handler.execute(new ApplyTemplateCommand('u1', 'platform_admin', 'admin1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('applies the tenant template and bumps the version', async () => {
    const prisma = prismaWith(false, false)
    const handler = new ApplyTemplateHandler(prisma as never, cache as never)
    await handler.execute(new ApplyTemplateCommand('u1', 'tenant', 'admin1'))
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { permission_template_id: 't1', permissions_version: { increment: 1 } },
      }),
    )
  })

  // Every mutating authorization command must reject a protected account, not just grant/revoke.
  // The fixture always returns `is_protected: false`, so this is asserted explicitly.
  it('refuses to apply any template to a protected account', async () => {
    const handler = new ApplyTemplateHandler(prismaWith(true, false, true) as never, cache as never)
    await expect(
      handler.execute(new ApplyTemplateCommand('u1', 'tenant', 'admin1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('invalidates the cache after applying a template', async () => {
    const prisma = prismaWith(true, true)
    const handler = new ApplyTemplateHandler(prisma as never, cache as never)
    await handler.execute(new ApplyTemplateCommand('u1', 'platform_admin', 'admin1'))
    expect(cache.invalidate).toHaveBeenCalledWith('u1')
  })

  // A template swap is a third route to the lockout revoke/deactivate already guard against.
  describe('last-holder guard (fix report item 1)', () => {
    it('refuses a swap that would leave zero active holders of permission.grant', async () => {
      const prisma = prismaWith(true, false, false, 0)
      const handler = new ApplyTemplateHandler(prisma as never, cache as never)
      const invalidateCallsBefore = cache.invalidate.mock.calls.length

      await expect(
        handler.execute(new ApplyTemplateCommand('u1', 'tenant', 'admin1')),
      ).rejects.toBeInstanceOf(AppException)

      // The update has to run inside the transaction for the count to see the post-swap state,
      // but a rolled-back change must never reach `cache.invalidate`. `cache` is shared across
      // this file, hence comparing call counts rather than `.not.toHaveBeenCalled()`.
      expect(prisma.user.update).toHaveBeenCalled()
      expect(cache.invalidate.mock.calls.length).toBe(invalidateCallsBefore)
    })

    it('allows a swap when at least one other active holder remains', async () => {
      const prisma = prismaWith(true, false, false, 1)
      const handler = new ApplyTemplateHandler(prisma as never, cache as never)
      await handler.execute(new ApplyTemplateCommand('u1', 'tenant', 'admin1'))
      expect(prisma.user.update).toHaveBeenCalled()
      expect(cache.invalidate).toHaveBeenCalledWith('u1')
    })
  })
})
