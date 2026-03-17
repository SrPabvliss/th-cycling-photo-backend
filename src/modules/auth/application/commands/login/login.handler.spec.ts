import { AppException } from '@shared/domain'
import { hashSync } from 'bcryptjs'
import type { IAuthUserRepository, IRefreshTokenRepository } from '../../../domain/ports'
import { LoginCommand } from './login.command'
import { LoginHandler } from './login.handler'

describe('LoginHandler', () => {
  let handler: LoginHandler
  let authUserRepo: jest.Mocked<IAuthUserRepository>
  let refreshTokenRepo: jest.Mocked<IRefreshTokenRepository>
  let jwtService: { sign: jest.Mock }
  let configService: { get: jest.Mock }

  beforeEach(() => {
    authUserRepo = {
      findByEmail: jest.fn(),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<IAuthUserRepository>

    refreshTokenRepo = {
      create: jest.fn().mockResolvedValue(undefined),
      findByHash: jest.fn(),
      revokeByHash: jest.fn(),
    } as jest.Mocked<IRefreshTokenRepository>

    jwtService = { sign: jest.fn().mockReturnValue('mock-jwt-token') }
    configService = { get: jest.fn().mockReturnValue(30) }

    handler = new LoginHandler(
      authUserRepo,
      refreshTokenRepo,
      jwtService as any,
      configService as any,
    )
  })

  const passwordHash = hashSync('CorrectPass123!', 10)

  it('should login successfully and return tokens', async () => {
    authUserRepo.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      passwordHash,
      isActive: true,
      role: 'admin',
    })

    const result = await handler.execute(new LoginCommand('user@test.com', 'CorrectPass123!'))

    expect(result.tokens.accessToken).toBe('mock-jwt-token')
    expect(result.refreshToken).toBeDefined()
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', email: 'user@test.com', role: 'admin' }),
    )
    expect(refreshTokenRepo.create).toHaveBeenCalledTimes(1)
    expect(authUserRepo.updateLastLogin).toHaveBeenCalledWith('user-1')
  })

  it('should reject non-existent email', async () => {
    authUserRepo.findByEmail.mockResolvedValue(null)

    await expect(handler.execute(new LoginCommand('wrong@test.com', 'password'))).rejects.toThrow(
      'auth.invalid_credentials',
    )
  })

  it('should reject wrong password', async () => {
    authUserRepo.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      passwordHash: hashSync('RealPassword', 10),
      isActive: true,
      role: 'admin',
    })

    await expect(
      handler.execute(new LoginCommand('user@test.com', 'WrongPassword!')),
    ).rejects.toThrow('auth.invalid_credentials')
  })

  it('should reject deactivated user', async () => {
    authUserRepo.findByEmail.mockResolvedValue({
      id: 'user-2',
      email: 'inactive@test.com',
      passwordHash: 'hash',
      isActive: false,
      role: 'classifier',
    })

    await expect(handler.execute(new LoginCommand('inactive@test.com', 'any'))).rejects.toThrow(
      'auth.account_deactivated',
    )
  })
})
