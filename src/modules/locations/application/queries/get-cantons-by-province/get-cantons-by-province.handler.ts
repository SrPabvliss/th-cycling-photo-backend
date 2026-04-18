import type { CantonProjection } from '@locations/application/projections'
import { type ILocationReadRepository, LOCATION_READ_REPOSITORY } from '@locations/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { GetCantonsByProvinceQuery } from './get-cantons-by-province.query'

@QueryHandler(GetCantonsByProvinceQuery)
export class GetCantonsByProvinceHandler implements IQueryHandler<GetCantonsByProvinceQuery> {
  constructor(
    @Inject(LOCATION_READ_REPOSITORY) private readonly readRepo: ILocationReadRepository,
  ) {}

  /** Returns cantons for a given province, sorted alphabetically. */
  async execute(query: GetCantonsByProvinceQuery): Promise<CantonProjection[]> {
    const exists = await this.readRepo.provinceExists(query.provinceId)
    if (!exists) throw AppException.notFound('Province', String(query.provinceId))

    return this.readRepo.findCantonsByProvinceId(query.provinceId)
  }
}
