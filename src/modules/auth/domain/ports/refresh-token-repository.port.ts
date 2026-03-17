import type { StoredRefreshTokenProjection } from '../../application/projections'

export interface IRefreshTokenRepository {
  create(data: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void>
  findByHash(tokenHash: string): Promise<StoredRefreshTokenProjection | null>
  revokeByHash(tokenHash: string): Promise<void>
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY')
