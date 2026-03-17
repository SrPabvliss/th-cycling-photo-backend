import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import type { IUserReadRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY } from '@users/domain/ports'
import type { UserDetailProjection } from '../../projections'
import { GetUserDetailQuery } from './get-user-detail.query'

@QueryHandler(GetUserDetailQuery)
export class GetUserDetailHandler implements IQueryHandler<GetUserDetailQuery> {
  constructor(@Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository) {}

  async execute(query: GetUserDetailQuery): Promise<UserDetailProjection> {
    const user = await this.readRepo.getUserDetail(query.id)
    if (!user) throw AppException.notFound('User', query.id)
    return user
  }
}
