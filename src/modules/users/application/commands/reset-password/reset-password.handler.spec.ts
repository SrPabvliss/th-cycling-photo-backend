import { AppException } from '@shared/domain'
import { User } from '@users/domain/entities'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { ResetPasswordCommand } from './reset-password.command'
import { ResetPasswordHandler } from './reset-password.handler'

describe('ResetPasswordHandler', () => {
  let handler: ResetPasswordHandler
  let readRepo: jest.Mocked<IUserReadRepository>
  let writeRepo: jest.Mocked<IUserWriteRepository>

  const existingUser = User.fromPersistence({
    id: 'user-1',
    email: 'user@test.com',
    passwordHash: '$2b$10$oldhashvalue',
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    avatarUrl: null,
    avatarStorageKey: null,
    isActive: true,
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

    handler = new ResetPasswordHandler(readRepo, writeRepo)
  })

  it('should reset password with a new bcrypt hash', async () => {
    readRepo.findById.mockResolvedValue(existingUser)
    writeRepo.save.mockImplementation(async (user: User) => user)

    const result = await handler.execute(new ResetPasswordCommand('user-1', 'NewSecurePass123!'))

    expect(result).toEqual({ id: 'user-1' })
    expect(writeRepo.save).toHaveBeenCalledTimes(1)

    const savedUser = writeRepo.save.mock.calls[0][0]
    expect(savedUser.passwordHash).not.toBe('$2b$10$oldhashvalue')
    expect(savedUser.passwordHash).not.toBe('NewSecurePass123!')
    expect(savedUser.passwordHash).toMatch(/^\$2[aby]?\$/)
  })

  it('should throw not found for missing user', async () => {
    readRepo.findById.mockResolvedValue(null)

    await expect(handler.execute(new ResetPasswordCommand('missing', 'pass'))).rejects.toThrow(
      AppException,
    )
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
