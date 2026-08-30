import type { UserPhoneProjection } from '../../application/projections/user-phone.projection'
import type { UserPhone } from '../entities'

export interface IUserPhoneReadRepository {
  findById(id: string): Promise<UserPhone | null>
  getByUserId(userId: string): Promise<UserPhoneProjection[]>
  countByUserId(userId: string): Promise<number>
  findByUserIdAndNumber(userId: string, phoneNumber: string): Promise<UserPhone | null>
}

export const USER_PHONE_READ_REPOSITORY = Symbol('USER_PHONE_READ_REPOSITORY')
