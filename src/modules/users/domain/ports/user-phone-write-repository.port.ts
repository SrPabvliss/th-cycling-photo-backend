import type { UserPhone } from '../entities'

export interface IUserPhoneWriteRepository {
  save(phone: UserPhone): Promise<UserPhone>
  delete(id: string): Promise<void>
  setPrimary(userId: string, phoneId: string): Promise<void>
}

export const USER_PHONE_WRITE_REPOSITORY = Symbol('USER_PHONE_WRITE_REPOSITORY')
