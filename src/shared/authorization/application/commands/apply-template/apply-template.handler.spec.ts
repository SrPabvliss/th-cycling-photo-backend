import { AppException } from '@shared/domain'
import { ApplyTemplateCommand } from './apply-template.command'
import { ApplyTemplateHandler } from './apply-template.handler'

describe('ApplyTemplateHandler', () => {
  const cache = { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() }

  const prismaWith = (isPlatform: boolean, templatePlatformOnly: boolean, isProtected = false) => ({
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
  })

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

  // Layer 2 (TIT-38 Task 13): every mutating authorization command must
  // reject a protected account, not just grant/revoke. Not exercised by
  // the fixture above (it always returns is_protected: false), so this is
  // asserted explicitly.
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
})
