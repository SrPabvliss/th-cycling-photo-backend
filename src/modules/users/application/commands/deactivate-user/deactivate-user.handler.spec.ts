import { AppException } from '@shared/domain'
import { User } from '@users/domain/entities'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { DeactivateUserCommand } from './deactivate-user.command'
import { DeactivateUserHandler } from './deactivate-user.handler'

describe('DeactivateUserHandler', () => {
  let readRepo: jest.Mocked<IUserReadRepository>
  let writeRepo: jest.Mocked<IUserWriteRepository>

  const activeUser = User.fromPersistence({
    id: 'user-1',
    email: 'user@test.com',
    passwordHash: 'hash',
    firstName: 'Test',
    lastName: 'User',

    avatarUrl: null,
    avatarStorageKey: null,
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: null,
  })

  const inactiveUser = User.fromPersistence({
    id: 'user-2',
    email: 'inactive@test.com',
    passwordHash: 'hash',
    firstName: 'Inactive',
    lastName: 'User',

    avatarUrl: null,
    avatarStorageKey: null,
    isActive: false,
    createdAt: new Date(),
    lastLoginAt: null,
  })

  // TIT-38 Task 13: mirrors `RevokePermissionHandler`'s `prismaWith` — the
  // handler queries `PrismaService` directly (not through the domain
  // repositories) for the two authorization guards, since `is_protected`
  // and last-holder status aren't modeled on the `User` domain entity.
  const prismaWith = (holders: number, isProtected = false) => ({
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ is_protected: isProtected }) },
    $queryRaw: jest.fn().mockResolvedValue([{ count: BigInt(holders) }]),
  })

  beforeEach(() => {
    readRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findTenantId: jest.fn(),
      getUsersList: jest.fn(),
      getUserDetail: jest.fn(),
      findActiveAdminIds: jest.fn(),
      getBuyersList: jest.fn(),
    } as jest.Mocked<IUserReadRepository>

    writeRepo = {
      save: jest.fn(),
    } as jest.Mocked<IUserWriteRepository>
  })

  it('should deactivate an active user', async () => {
    readRepo.findById.mockResolvedValue(activeUser)
    writeRepo.save.mockImplementation(async (user: User) => user)
    const prisma = prismaWith(2)
    const handler = new DeactivateUserHandler(readRepo, writeRepo, prisma as never)

    const result = await handler.execute(new DeactivateUserCommand('user-1'))

    expect(result).toEqual({ id: 'user-1' })
    expect(writeRepo.save).toHaveBeenCalledTimes(1)

    const savedUser = writeRepo.save.mock.calls[0][0]
    expect(savedUser.isActive).toBe(false)
  })

  it('should throw not found for missing user', async () => {
    readRepo.findById.mockResolvedValue(null)
    const handler = new DeactivateUserHandler(readRepo, writeRepo, prismaWith(2) as never)

    await expect(handler.execute(new DeactivateUserCommand('missing'))).rejects.toThrow(
      AppException,
    )
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('should throw business rule for already deactivated user', async () => {
    readRepo.findById.mockResolvedValue(inactiveUser)
    const handler = new DeactivateUserHandler(readRepo, writeRepo, prismaWith(2) as never)

    await expect(handler.execute(new DeactivateUserCommand('user-2'))).rejects.toThrow(
      'user.already_deactivated',
    )
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  // TIT-38 Task 13, Layer 2: the break-glass account rejects deactivation
  // too, including of itself — this is the same invariant
  // Grant/Revoke/ApplyTemplateHandler enforce.
  it('refuses to deactivate a protected account', async () => {
    readRepo.findById.mockResolvedValue(activeUser)
    const handler = new DeactivateUserHandler(readRepo, writeRepo, prismaWith(2, true) as never)

    await expect(handler.execute(new DeactivateUserCommand('user-1'))).rejects.toBeInstanceOf(
      AppException,
    )
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  // TIT-38 Task 13, Layer 1: deactivating the last holder of
  // `permission.grant` is the same lockout as revoking it directly.
  it('refuses to deactivate the last holder of permission.grant', async () => {
    readRepo.findById.mockResolvedValue(activeUser)
    const handler = new DeactivateUserHandler(readRepo, writeRepo, prismaWith(0) as never)

    await expect(handler.execute(new DeactivateUserCommand('user-1'))).rejects.toBeInstanceOf(
      AppException,
    )
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  // Proves the guard asks "how many holders remain besides this user" —
  // not "how many holders exist platform-wide". A platform with exactly
  // one admin must still allow deactivating an unrelated account; only
  // the admin's own deactivation should be blocked. Mutating the handler
  // to reuse RevokePermissionHandler's unconditional "<= 1 total" check
  // instead of the exclusion-based "=== 0 remaining" check would fail
  // this test, even though every other test in this file would still pass.
  it('allows deactivating an unrelated user even when the platform has only one admin elsewhere', async () => {
    // A fresh instance, not the shared `activeUser` fixture: `deactivate()`
    // mutates in place, and `activeUser` is reused (and deactivated) by
    // an earlier test in this file.
    const unrelatedUser = User.fromPersistence({
      id: 'user-3',
      email: 'unrelated@test.com',
      passwordHash: 'hash',
      firstName: 'Unrelated',
      lastName: 'User',
      avatarUrl: null,
      avatarStorageKey: null,
      isActive: true,
      createdAt: new Date(),
      lastLoginAt: null,
    })
    readRepo.findById.mockResolvedValue(unrelatedUser)
    writeRepo.save.mockImplementation(async (user: User) => user)
    // countActivePermissionGrantHolders(prisma, 'user-3') is mocked to
    // return 1 — one holder remains who *isn't* user-3, so removing
    // user-3 (who was never counted, since they were excluded from this
    // very query) cannot be the lockout.
    const handler = new DeactivateUserHandler(readRepo, writeRepo, prismaWith(1) as never)

    const result = await handler.execute(new DeactivateUserCommand('user-3'))

    expect(result).toEqual({ id: 'user-3' })
    expect(writeRepo.save).toHaveBeenCalledTimes(1)
  })
})
