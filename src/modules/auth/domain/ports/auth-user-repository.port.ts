import type {
  AuthUserProjection,
  MeProjection,
  RegisteredUserProjection,
  UserSnapDataProjection,
} from '../../application/projections'
import type { RegisterUserPayload } from '../payloads'

export interface IAuthUserRepository {
  findByEmail(email: string): Promise<AuthUserProjection | null>
  updateLastLogin(userId: string): Promise<void>
  getMe(userId: string): Promise<MeProjection | null>
  register(payload: RegisterUserPayload): Promise<RegisteredUserProjection>
  findByEmailExists(email: string): Promise<boolean>
  getUserSnapData(userId: string): Promise<UserSnapDataProjection | null>
}

export const AUTH_USER_REPOSITORY = Symbol('AUTH_USER_REPOSITORY')
