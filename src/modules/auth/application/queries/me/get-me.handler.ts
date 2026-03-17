import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { MeProjection } from '../../projections'
import { GetMeQuery } from './get-me.query'

@QueryHandler(GetMeQuery)
export class GetMeHandler implements IQueryHandler<GetMeQuery> {
  async execute(query: GetMeQuery): Promise<MeProjection> {
    return {
      id: query.userId,
      email: query.email,
      role: query.role,
    }
  }
}
