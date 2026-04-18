import type { IRefreshTokenRepository, ITokenHashService } from '../../../domain/ports'
import { LogoutCommand } from './logout.command'
import { LogoutHandler } from './logout.handler'

describe('LogoutHandler', () => {
  let handler: LogoutHandler
  let refreshTokenRepo: jest.Mocked<IRefreshTokenRepository>
  let tokenHashService: jest.Mocked<ITokenHashService>

  beforeEach(() => {
    refreshTokenRepo = {
      create: jest.fn(),
      findByHash: jest.fn(),
      revokeByHash: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<IRefreshTokenRepository>

    tokenHashService = {
      hash: jest.fn().mockReturnValue('hashed-token'),
      generateToken: jest.fn().mockReturnValue('new-raw-uuid'),
    } as jest.Mocked<ITokenHashService>

    handler = new LogoutHandler(refreshTokenRepo, tokenHashService)
  })

  it('should revoke the refresh token', async () => {
    await handler.execute(new LogoutCommand('some-uuid-token'))

    expect(tokenHashService.hash).toHaveBeenCalledWith('some-uuid-token')
    expect(refreshTokenRepo.revokeByHash).toHaveBeenCalledTimes(1)
    expect(refreshTokenRepo.revokeByHash).toHaveBeenCalledWith('hashed-token')
  })
})
