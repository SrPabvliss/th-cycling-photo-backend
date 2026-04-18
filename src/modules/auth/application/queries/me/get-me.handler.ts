import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { AUTH_USER_REPOSITORY, type IAuthUserRepository } from '../../../domain/ports'
import type { MeProjection } from '../../projections'
import { GetMeQuery } from './get-me.query'

@QueryHandler(GetMeQuery)
export class GetMeHandler implements IQueryHandler<GetMeQuery> {
  constructor(@Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository) {}

  async execute(query: GetMeQuery): Promise<MeProjection> {
    const me = await this.authUserRepo.getMe(query.userId)
    if (!me) throw AppException.businessRule('auth.user_not_found')

    if (!me.role) me.role = query.role

    return me
  }
}
