import type { User } from '../entities'

export interface IUserWriteRepository {
  save(user: User, roleName?: string): Promise<User>
}

export const USER_WRITE_REPOSITORY = Symbol('USER_WRITE_REPOSITORY')
