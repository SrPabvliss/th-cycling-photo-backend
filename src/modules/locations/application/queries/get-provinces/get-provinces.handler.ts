import type { ProvinceProjection } from '@locations/application/projections'
import { type ILocationReadRepository, LOCATION_READ_REPOSITORY } from '@locations/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { GetProvincesQuery } from './get-provinces.query'

@QueryHandler(GetProvincesQuery)
export class GetProvincesHandler implements IQueryHandler<GetProvincesQuery> {
  constructor(
    @Inject(LOCATION_READ_REPOSITORY) private readonly readRepo: ILocationReadRepository,
  ) {}

  /** Returns all provinces sorted alphabetically. */
  async execute(_query: GetProvincesQuery): Promise<ProvinceProjection[]> {
    return this.readRepo.findAllProvinces()
  }
}
