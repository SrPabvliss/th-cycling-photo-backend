import type { AuthUserProjection } from '../../application/projections'

export interface IAuthUserRepository {
  findByEmail(email: string): Promise<AuthUserProjection | null>
  updateLastLogin(userId: string): Promise<void>
}

export const AUTH_USER_REPOSITORY = Symbol('AUTH_USER_REPOSITORY')
