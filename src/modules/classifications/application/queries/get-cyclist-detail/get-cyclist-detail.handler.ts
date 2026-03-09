import type { CyclistDetailProjection } from '@classifications/application/projections'
import { CYCLIST_READ_REPOSITORY, type ICyclistReadRepository } from '@classifications/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { GetCyclistDetailQuery } from './get-cyclist-detail.query'

@QueryHandler(GetCyclistDetailQuery)
export class GetCyclistDetailHandler implements IQueryHandler<GetCyclistDetailQuery> {
  constructor(@Inject(CYCLIST_READ_REPOSITORY) private readonly readRepo: ICyclistReadRepository) {}

  async execute(query: GetCyclistDetailQuery): Promise<CyclistDetailProjection> {
    const cyclist = await this.readRepo.getCyclistDetail(query.cyclistId)
    if (!cyclist) throw AppException.notFound('Cyclist', query.cyclistId)
    return cyclist
  }
}
