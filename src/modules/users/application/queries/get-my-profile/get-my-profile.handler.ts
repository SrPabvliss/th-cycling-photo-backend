import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import type { IUserReadRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY } from '@users/domain/ports'
import type { MyProfileProjection } from '../../projections'
import { GetMyProfileQuery } from './get-my-profile.query'

@QueryHandler(GetMyProfileQuery)
export class GetMyProfileHandler implements IQueryHandler<GetMyProfileQuery> {
  constructor(@Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository) {}

  async execute(query: GetMyProfileQuery): Promise<MyProfileProjection> {
    const profile = await this.readRepo.getMyProfile(query.userId)
    if (!profile) throw AppException.notFound('User', query.userId)
    return profile
  }
}
