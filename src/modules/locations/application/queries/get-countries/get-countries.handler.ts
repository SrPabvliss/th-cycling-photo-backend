import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type ILocationReadRepository, LOCATION_READ_REPOSITORY } from '../../../domain/ports'
import type { CountryProjection } from '../../projections'
import { GetCountriesQuery } from './get-countries.query'

@QueryHandler(GetCountriesQuery)
export class GetCountriesHandler implements IQueryHandler<GetCountriesQuery> {
  constructor(
    @Inject(LOCATION_READ_REPOSITORY) private readonly readRepo: ILocationReadRepository,
  ) {}

  async execute(_query: GetCountriesQuery): Promise<CountryProjection[]> {
    return this.readRepo.findAllCountries()
  }
}
