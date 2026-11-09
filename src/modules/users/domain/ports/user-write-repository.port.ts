import type { User } from '../entities'
import type { UpdateProfilePayload } from '../payloads'

export interface IUserWriteRepository {
  save(user: User, roleName?: string): Promise<User>
  updateProfile(userId: string, data: UpdateProfilePayload): Promise<void>
}

export const USER_WRITE_REPOSITORY = Symbol('USER_WRITE_REPOSITORY')
