import { ForbiddenException } from '@nestjs/common'
import { AppException } from '@shared/domain'
import { PhotoCategory } from '../../../domain/entities'
import { CreatePhotoCategoryCommand } from './create-photo-category.command'
import { CreatePhotoCategoryHandler } from './create-photo-category.handler'

describe('CreatePhotoCategoryHandler', () => {
  const setup = (tenantId: string | null = 't-1', clash: PhotoCategory | null = null) => {
    const readRepo = { findClashing: jest.fn().mockResolvedValue(clash) }
    const writeRepo = {
      save: jest.fn(async (c: PhotoCategory) =>
        PhotoCategory.fromPersistence({
          id: 42,
          name: c.name,
          tenantId: c.tenantId,
          createdAt: c.createdAt,
        }),
      ),
    }
    const userRepo = { findTenantId: jest.fn().mockResolvedValue(tenantId) }
    const authz = { assert: jest.fn().mockResolvedValue(undefined) }
    const handler = new CreatePhotoCategoryHandler(
      readRepo as never,
      writeRepo as never,
      userRepo as never,
      authz as never,
    )
    return { handler, readRepo, writeRepo, authz }
  }

  it('creates an own category for the caller tenant', async () => {
    const { handler, writeRepo, readRepo } = setup()

    await expect(
      handler.execute(new CreatePhotoCategoryCommand(' Enduro Kids ', 'u1', false)),
    ).resolves.toEqual({ id: '42' })
    expect(readRepo.findClashing).toHaveBeenCalledWith(' Enduro Kids ', 't-1')
    expect(writeRepo.save.mock.calls[0][0]).toMatchObject({ name: 'Enduro Kids', tenantId: 't-1' })
  })

  it('creates a base category only through photo_category.base.manage', async () => {
    const { handler, writeRepo, authz } = setup()

    await handler.execute(new CreatePhotoCategoryCommand('Podio', 'admin', true))

    expect(authz.assert).toHaveBeenCalledWith('admin', 'photo_category.base.manage')
    expect(writeRepo.save.mock.calls[0][0].tenantId).toBeNull()
  })

  it('refuses a base category to whoever lacks the key', async () => {
    const { handler, authz, writeRepo } = setup()
    authz.assert.mockRejectedValueOnce(new ForbiddenException())

    await expect(
      handler.execute(new CreatePhotoCategoryCommand('Podio', 'u1', true)),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('refuses an own category to a user without a tenant', async () => {
    const { handler } = setup(null)

    const error = await handler
      .execute(new CreatePhotoCategoryCommand('X', 'buyer', false))
      .catch((e) => e)

    expect(error.messageKey).toBe('photo_category.tenant_required')
  })

  it('refuses a name clashing with a base or own category', async () => {
    const clash = PhotoCategory.fromPersistence({
      id: 3,
      name: 'Competencia',
      tenantId: null,
      createdAt: new Date(),
    })
    const { handler, writeRepo } = setup('t-1', clash)

    const error = await handler
      .execute(new CreatePhotoCategoryCommand('competencia', 'u1', false))
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('CONFLICT')
    expect(error.messageKey).toBe('photo_category.name_taken')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
