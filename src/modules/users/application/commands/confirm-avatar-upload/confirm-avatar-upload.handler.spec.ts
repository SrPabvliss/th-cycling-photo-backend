import type { IStorageAdapter } from '@shared/storage/domain/ports'
import { User } from '@users/domain/entities'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { ConfirmAvatarUploadCommand } from './confirm-avatar-upload.command'
import { ConfirmAvatarUploadHandler } from './confirm-avatar-upload.handler'

describe('ConfirmAvatarUploadHandler', () => {
  const USER_ID = 'user-uuid'

  let handler: ConfirmAvatarUploadHandler
  let readRepo: jest.Mocked<IUserReadRepository>
  let writeRepo: jest.Mocked<IUserWriteRepository>
  let storage: jest.Mocked<IStorageAdapter>

  const buildUser = (overrides: { avatarStorageKey: string | null; avatarUrl?: string | null }) =>
    User.fromPersistence({
      id: USER_ID,
      email: 'user@test.com',
      passwordHash: 'hash',
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: overrides.avatarUrl ?? null,
      avatarStorageKey: overrides.avatarStorageKey,
      isActive: true,
      createdAt: new Date(),
      lastLoginAt: null,
    })

  beforeEach(() => {
    readRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<IUserReadRepository>

    writeRepo = {
      save: jest.fn(),
    } as unknown as jest.Mocked<IUserWriteRepository>

    storage = {
      getPublicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IStorageAdapter>

    handler = new ConfirmAvatarUploadHandler(readRepo, writeRepo, storage)
  })

  it('stores the public URL alongside the storage key', async () => {
    const user = buildUser({ avatarStorageKey: null })
    readRepo.findById.mockResolvedValue(user)

    await handler.execute(
      new ConfirmAvatarUploadCommand(USER_ID, `users/${USER_ID}/avatar/pic.jpg`),
    )

    expect(storage.getPublicUrl).toHaveBeenCalledWith(`users/${USER_ID}/avatar/pic.jpg`)
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: `https://cdn.test/users/${USER_ID}/avatar/pic.jpg`,
        avatarStorageKey: `users/${USER_ID}/avatar/pic.jpg`,
      }),
    )
  })

  it('rejects a storage key outside the user avatar prefix', async () => {
    const user = buildUser({ avatarStorageKey: null })
    readRepo.findById.mockResolvedValue(user)

    await expect(
      handler.execute(new ConfirmAvatarUploadCommand(USER_ID, 'users/other-user/avatar/pic.jpg')),
    ).rejects.toThrow(/user\.invalid_avatar_storage_key/)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('deletes the old storage key when replacing it with a different one', async () => {
    const oldKey = `users/${USER_ID}/avatar/old.jpg`
    const newKey = `users/${USER_ID}/avatar/new.jpg`
    const user = buildUser({ avatarStorageKey: oldKey, avatarUrl: `https://cdn.test/${oldKey}` })
    readRepo.findById.mockResolvedValue(user)

    await handler.execute(new ConfirmAvatarUploadCommand(USER_ID, newKey))

    expect(storage.delete).toHaveBeenCalledWith(oldKey)
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: `https://cdn.test/${newKey}`,
        avatarStorageKey: newKey,
      }),
    )
  })
})
