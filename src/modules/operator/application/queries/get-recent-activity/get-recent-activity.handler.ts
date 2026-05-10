import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PaginatedResult } from '@shared/application'
import { I18nService } from 'nestjs-i18n'
import { type IOperatorReadRepository, OPERATOR_READ_REPOSITORY } from '../../../domain/ports'
import { toRecentActivityProjection } from '../../../infrastructure/mappers/recent-activity.mapper'
import type { RecentActivityProjection } from '../../projections/recent-activity.projection'
import { GetRecentActivityQuery } from './get-recent-activity.query'

@QueryHandler(GetRecentActivityQuery)
export class GetRecentActivityHandler implements IQueryHandler<GetRecentActivityQuery> {
  constructor(
    @Inject(OPERATOR_READ_REPOSITORY)
    private readonly repo: IOperatorReadRepository,
    private readonly i18n: I18nService,
  ) {}

  async execute(query: GetRecentActivityQuery): Promise<PaginatedResult<RecentActivityProjection>> {
    const { items, total } = await this.repo.getRecentActivity(
      query.operatorId,
      query.pagination.skip,
      query.pagination.take,
    )
    const projected = items.map((row) => toRecentActivityProjection(row, this.i18n, query.lang))
    return new PaginatedResult(projected, total, query.pagination)
  }
}
