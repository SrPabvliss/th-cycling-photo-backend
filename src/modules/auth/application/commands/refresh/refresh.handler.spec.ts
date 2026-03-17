import * as crypto from 'node:crypto'
import type { IRefreshTokenRepository } from '../../../domain/ports'
import type { StoredRefreshTokenProjection } from '../../projections'
import { RefreshCommand } from './refresh.command'
import { RefreshHandler } from './refresh.handler'

describe('RefreshHandler', () => {
  let handler: RefreshHandler
  let refreshTokenRepo: jest.Mocked<IRefreshTokenRepository>
  let jwtService: { sign: jest.Mock }

  const rawToken = crypto.randomUUID()
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 30)

  const validStoredToken: StoredRefreshTokenProjection = {
    userId: 'user-1',
    email: 'user@test.com',
    role: 'admin',
    isActive: true,
    revokedAt: null,
    expiresAt: futureDate,
  }

  beforeEach(() => {
    refreshTokenRepo = {
      create: jest.fn(),
      findByHash: jest.fn(),
      revokeByHash: jest.fn(),
    } as jest.Mocked<IRefreshTokenRepository>

    jwtService = { sign: jest.fn().mockReturnValue('new-jwt-token') }

    handler = new RefreshHandler(refreshTokenRepo, jwtService as any)
  })

  it('should issue new access token for valid refresh token', async () => {
    refreshTokenRepo.findByHash.mockResolvedValue(validStoredToken)

    const result = await handler.execute(new RefreshCommand(rawToken))

    expect(result.accessToken).toBe('new-jwt-token')
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', email: 'user@test.com', role: 'admin' }),
    )
  })

  it('should reject unknown refresh token', async () => {
    refreshTokenRepo.findByHash.mockResolvedValue(null)

    await expect(handler.execute(new RefreshCommand('unknown-token'))).rejects.toThrow(
      'auth.invalid_refresh_token',
    )
  })

  it('should reject revoked refresh token', async () => {
    refreshTokenRepo.findByHash.mockResolvedValue({ ...validStoredToken, revokedAt: new Date() })

    await expect(handler.execute(new RefreshCommand(rawToken))).rejects.toThrow(
      'auth.token_revoked',
    )
  })

  it('should reject expired refresh token', async () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    refreshTokenRepo.findByHash.mockResolvedValue({ ...validStoredToken, expiresAt: pastDate })

    await expect(handler.execute(new RefreshCommand(rawToken))).rejects.toThrow(
      'auth.token_expired',
    )
  })

  it('should reject if user is deactivated', async () => {
    refreshTokenRepo.findByHash.mockResolvedValue({ ...validStoredToken, isActive: false })

    await expect(handler.execute(new RefreshCommand(rawToken))).rejects.toThrow(
      'auth.account_deactivated',
    )
  })
})
