import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type ILocationReadRepository, LOCATION_READ_REPOSITORY } from '../../../domain/ports'
import type { ProvinceProjection } from '../../projections'
import { GetProvincesByCountryQuery } from './get-provinces-by-country.query'

@QueryHandler(GetProvincesByCountryQuery)
export class GetProvincesByCountryHandler implements IQueryHandler<GetProvincesByCountryQuery> {
  constructor(
    @Inject(LOCATION_READ_REPOSITORY) private readonly readRepo: ILocationReadRepository,
  ) {}

  async execute(query: GetProvincesByCountryQuery): Promise<ProvinceProjection[]> {
    return this.readRepo.findProvincesByCountryId(query.countryId)
  }
}
