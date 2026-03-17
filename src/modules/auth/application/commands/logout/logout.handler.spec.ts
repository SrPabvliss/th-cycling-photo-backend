import type { IRefreshTokenRepository } from '../../../domain/ports'
import { LogoutCommand } from './logout.command'
import { LogoutHandler } from './logout.handler'

describe('LogoutHandler', () => {
  let handler: LogoutHandler
  let refreshTokenRepo: jest.Mocked<IRefreshTokenRepository>

  beforeEach(() => {
    refreshTokenRepo = {
      create: jest.fn(),
      findByHash: jest.fn(),
      revokeByHash: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<IRefreshTokenRepository>

    handler = new LogoutHandler(refreshTokenRepo)
  })

  it('should revoke the refresh token', async () => {
    await handler.execute(new LogoutCommand('some-uuid-token'))

    expect(refreshTokenRepo.revokeByHash).toHaveBeenCalledTimes(1)
    expect(refreshTokenRepo.revokeByHash).toHaveBeenCalledWith(expect.any(String))
  })
})
