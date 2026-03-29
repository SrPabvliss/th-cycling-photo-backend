import type { PaginatedResult, Pagination } from '@shared/application'
import type { UserDetailProjection, UserListProjection } from '../../application/projections'
import type { User } from '../entities'

export interface IUserReadRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  getUsersList(
    pagination: Pagination,
    includeInactive?: boolean,
  ): Promise<PaginatedResult<UserListProjection>>
  getUserDetail(id: string): Promise<UserDetailProjection | null>
  findActiveAdminIds(): Promise<string[]>
}

export const USER_READ_REPOSITORY = Symbol('USER_READ_REPOSITORY')
