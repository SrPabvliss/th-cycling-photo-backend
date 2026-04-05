import type {
  CantonProjection,
  CountryProjection,
  ProvinceProjection,
} from '@locations/application/projections'

export interface ILocationReadRepository {
  findAllCountries(): Promise<CountryProjection[]>
  findAllProvinces(): Promise<ProvinceProjection[]>
  findProvincesByCountryId(countryId: number): Promise<ProvinceProjection[]>
  findCantonsByProvinceId(provinceId: number): Promise<CantonProjection[]>
  provinceExists(id: number): Promise<boolean>
  countryExists(id: number): Promise<boolean>
  provinceExistsInCountry(provinceId: number, countryId: number): Promise<boolean>
  cantonExistsInProvince(cantonId: number, provinceId: number): Promise<boolean>
}

export const LOCATION_READ_REPOSITORY = Symbol('LOCATION_READ_REPOSITORY')
