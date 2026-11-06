import type {
  IAuthUserRepository,
  IRefreshTokenRepository,
  ITokenHashService,
} from '../../../domain/ports'
import { LogoutCommand } from './logout.command'
import { LogoutHandler } from './logout.handler'

describe('LogoutHandler', () => {
  let handler: LogoutHandler
  let refreshTokenRepo: jest.Mocked<IRefreshTokenRepository>
  let tokenHashService: jest.Mocked<ITokenHashService>
  let authUserRepo: { bumpSessionVersion: jest.Mock }

  beforeEach(() => {
    refreshTokenRepo = {
      create: jest.fn(),
      findByHash: jest.fn(),
      revokeByHash: jest.fn().mockResolvedValue(undefined),
      revokeAllExcept: jest.fn(),
    } as jest.Mocked<IRefreshTokenRepository>

    tokenHashService = {
      hash: jest.fn().mockReturnValue('hashed-token'),
      generateToken: jest.fn().mockReturnValue('new-raw-uuid'),
    } as jest.Mocked<ITokenHashService>

    authUserRepo = { bumpSessionVersion: jest.fn().mockResolvedValue(1) }

    handler = new LogoutHandler(
      refreshTokenRepo,
      tokenHashService,
      authUserRepo as unknown as IAuthUserRepository,
    )
  })

  it('should revoke the refresh token', async () => {
    await handler.execute(new LogoutCommand('some-uuid-token'))

    expect(tokenHashService.hash).toHaveBeenCalledWith('some-uuid-token')
    expect(refreshTokenRepo.revokeByHash).toHaveBeenCalledTimes(1)
    expect(refreshTokenRepo.revokeByHash).toHaveBeenCalledWith('hashed-token')
  })

  it('invalidates the access tokens of a live session', async () => {
    refreshTokenRepo.findByHash.mockResolvedValue({
      userId: 'user-1',
      email: 'a@b.c',
      role: 'customer',
      isActive: true,
      permissionsVersion: 0,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    })

    await handler.execute(new LogoutCommand('some-uuid-token'))

    expect(authUserRepo.bumpSessionVersion).toHaveBeenCalledWith('user-1')
  })

  it('does not touch the version for an unknown or already revoked token', async () => {
    refreshTokenRepo.findByHash.mockResolvedValue(null)

    await handler.execute(new LogoutCommand('some-uuid-token'))

    expect(authUserRepo.bumpSessionVersion).not.toHaveBeenCalled()
  })
})
