import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PaginatedResult } from '@shared/application'
import type { IUserReadRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY } from '@users/domain/ports'
import type { UserListProjection } from '../../projections'
import { GetUsersListQuery } from './get-users-list.query'

@QueryHandler(GetUsersListQuery)
export class GetUsersListHandler implements IQueryHandler<GetUsersListQuery> {
  constructor(@Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository) {}

  async execute(query: GetUsersListQuery): Promise<PaginatedResult<UserListProjection>> {
    return this.readRepo.getUsersList(query.pagination, query.includeInactive)
  }
}
