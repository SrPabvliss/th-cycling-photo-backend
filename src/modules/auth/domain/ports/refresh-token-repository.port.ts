import type { StoredRefreshTokenProjection } from '../../application/projections'
import type { CreateRefreshTokenPayload } from '../payloads'

export interface IRefreshTokenRepository {
  create(payload: CreateRefreshTokenPayload): Promise<void>
  findByHash(tokenHash: string): Promise<StoredRefreshTokenProjection | null>
  revokeByHash(tokenHash: string): Promise<void>
  revokeAllExcept(userId: string, keepTokenHash: string | null): Promise<number>
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY')
