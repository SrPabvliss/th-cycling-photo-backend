import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { IUserPhoneReadRepository } from '@users/domain/ports'
import { USER_PHONE_READ_REPOSITORY } from '@users/domain/ports'
import type { UserPhoneProjection } from '../../projections'
import { GetUserPhonesQuery } from './get-user-phones.query'

@QueryHandler(GetUserPhonesQuery)
export class GetUserPhonesHandler implements IQueryHandler<GetUserPhonesQuery> {
  constructor(
    @Inject(USER_PHONE_READ_REPOSITORY) private readonly readRepo: IUserPhoneReadRepository,
  ) {}

  async execute(query: GetUserPhonesQuery): Promise<UserPhoneProjection[]> {
    return this.readRepo.getByUserId(query.userId)
  }
}
