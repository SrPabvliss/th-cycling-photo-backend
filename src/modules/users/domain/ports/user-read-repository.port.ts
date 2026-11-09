import type { PaginatedResult, Pagination } from '@shared/application'
import type {
  BuyerDetailProjection,
  BuyerListProjection,
  BuyersStatsProjection,
  MyProfileProjection,
  UserDetailProjection,
  UserListProjection,
} from '../../application/projections'
import type { User } from '../entities'

export type BuyerListFilters = {
  search?: string
  purchase?: string
  sort?: string
  countryId?: number
  provinceId?: number
  registeredFrom?: Date
  registeredTo?: Date
  gender?: string
  ageFrom?: number
  ageTo?: number
  emailVerified?: boolean
  hasWhatsapp?: boolean
}

export interface IUserReadRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  /** Returns the tenant a user belongs to, or null if they are not tenant-scoped (e.g. buyers). */
  findTenantId(userId: string): Promise<string | null>
  getUsersList(
    pagination: Pagination,
    includeInactive?: boolean,
    role?: string,
    search?: string,
  ): Promise<PaginatedResult<UserListProjection>>
  getUserDetail(id: string): Promise<UserDetailProjection | null>
  findActiveAdminIds(): Promise<string[]>
  getBuyersList(
    pagination: Pagination,
    filters: BuyerListFilters,
  ): Promise<PaginatedResult<BuyerListProjection>>
  getBuyersStats(filters: BuyerListFilters): Promise<BuyersStatsProjection>
  getBuyerDetail(id: string): Promise<BuyerDetailProjection | null>
  getMyProfile(userId: string): Promise<MyProfileProjection | null>
}

export const USER_READ_REPOSITORY = Symbol('USER_READ_REPOSITORY')
