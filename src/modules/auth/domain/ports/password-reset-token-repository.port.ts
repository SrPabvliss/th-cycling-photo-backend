import type { StoredPasswordResetTokenProjection } from '../../application/projections'
import type { CreatePasswordResetTokenPayload } from '../payloads'

export interface IPasswordResetTokenRepository {
  create(payload: CreatePasswordResetTokenPayload): Promise<void>
  findById(id: string): Promise<StoredPasswordResetTokenProjection | null>
  findLastCreatedAtForUser(userId: string): Promise<Date | null>
  consumeAndUpdatePassword(tokenId: string, userId: string, passwordHash: string): Promise<boolean>
}

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PASSWORD_RESET_TOKEN_REPOSITORY')
