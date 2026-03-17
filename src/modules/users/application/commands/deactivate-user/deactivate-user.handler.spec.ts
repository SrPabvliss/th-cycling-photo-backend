import { AppException } from '@shared/domain'
import { User } from '@users/domain/entities'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { DeactivateUserCommand } from './deactivate-user.command'
import { DeactivateUserHandler } from './deactivate-user.handler'

describe('DeactivateUserHandler', () => {
  let handler: DeactivateUserHandler
  let readRepo: jest.Mocked<IUserReadRepository>
  let writeRepo: jest.Mocked<IUserWriteRepository>

  const activeUser = User.fromPersistence({
    id: 'user-1',
    email: 'user@test.com',
    passwordHash: 'hash',
    firstName: 'Test',
    lastName: 'User',
    phone: null,
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
    phone: null,
    avatarUrl: null,
    avatarStorageKey: null,
    isActive: false,
    createdAt: new Date(),
    lastLoginAt: null,
  })

  beforeEach(() => {
    readRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      getUsersList: jest.fn(),
      getUserDetail: jest.fn(),
    } as jest.Mocked<IUserReadRepository>

    writeRepo = {
      save: jest.fn(),
    } as jest.Mocked<IUserWriteRepository>

    handler = new DeactivateUserHandler(readRepo, writeRepo)
  })

  it('should deactivate an active user', async () => {
    readRepo.findById.mockResolvedValue(activeUser)
    writeRepo.save.mockImplementation(async (user: User) => user)

    const result = await handler.execute(new DeactivateUserCommand('user-1'))

    expect(result).toEqual({ id: 'user-1' })
    expect(writeRepo.save).toHaveBeenCalledTimes(1)

    const savedUser = writeRepo.save.mock.calls[0][0]
    expect(savedUser.isActive).toBe(false)
  })

  it('should throw not found for missing user', async () => {
    readRepo.findById.mockResolvedValue(null)

    await expect(handler.execute(new DeactivateUserCommand('missing'))).rejects.toThrow(
      AppException,
    )
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('should throw business rule for already deactivated user', async () => {
    readRepo.findById.mockResolvedValue(inactiveUser)

    await expect(handler.execute(new DeactivateUserCommand('user-2'))).rejects.toThrow(
      'user.already_deactivated',
    )
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
