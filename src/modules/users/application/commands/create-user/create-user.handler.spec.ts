import { AppException } from '@shared/domain'
import { User } from '@users/domain/entities'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { CreateUserCommand } from './create-user.command'
import { CreateUserHandler } from './create-user.handler'

describe('CreateUserHandler', () => {
  let handler: CreateUserHandler
  let writeRepo: jest.Mocked<IUserWriteRepository>
  let readRepo: jest.Mocked<IUserReadRepository>

  beforeEach(() => {
    writeRepo = {
      save: jest.fn(),
    } as jest.Mocked<IUserWriteRepository>

    readRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      getUsersList: jest.fn(),
      getUserDetail: jest.fn(),
    } as jest.Mocked<IUserReadRepository>

    handler = new CreateUserHandler(writeRepo, readRepo)
  })

  it('should create user with hashed password and return id', async () => {
    const command = new CreateUserCommand(
      'Pablo',
      'Villacres',
      'pablo@test.com',
      null,
      'admin',
      'SecurePass123!',
    )

    readRepo.findByEmail.mockResolvedValue(null)
    writeRepo.save.mockImplementation(async (user: User) => user)

    const result = await handler.execute(command)

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    expect(readRepo.findByEmail).toHaveBeenCalledWith('pablo@test.com')
    expect(writeRepo.save).toHaveBeenCalledTimes(1)

    const savedUser = writeRepo.save.mock.calls[0][0]
    expect(savedUser.email).toBe('pablo@test.com')
    expect(savedUser.firstName).toBe('Pablo')
    expect(savedUser.lastName).toBe('Villacres')
    expect(savedUser.passwordHash).not.toBe('SecurePass123!')
    expect(savedUser.passwordHash).toMatch(/^\$2[aby]?\$/)
    expect(savedUser.isActive).toBe(true)

    const savedRole = writeRepo.save.mock.calls[0][1]
    expect(savedRole).toBe('admin')
  })

  it('should reject duplicate email', async () => {
    const command = new CreateUserCommand(
      'Pablo',
      'Villacres',
      'existing@test.com',
      null,
      'admin',
      'SecurePass123!',
    )

    readRepo.findByEmail.mockResolvedValue(
      User.fromPersistence({
        id: 'existing-id',
        email: 'existing@test.com',
        passwordHash: 'hash',
        firstName: 'Existing',
        lastName: 'User',
        phone: null,
        avatarUrl: null,
        avatarStorageKey: null,
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: null,
      }),
    )

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('should reject invalid email format', async () => {
    const command = new CreateUserCommand(
      'Pablo',
      'Villacres',
      'not-an-email',
      null,
      'admin',
      'SecurePass123!',
    )

    readRepo.findByEmail.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
