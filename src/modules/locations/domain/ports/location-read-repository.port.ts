import type { CantonProjection, ProvinceProjection } from '@locations/application/projections'

export interface ILocationReadRepository {
  findAllProvinces(): Promise<ProvinceProjection[]>
  findCantonsByProvinceId(provinceId: number): Promise<CantonProjection[]>
  provinceExists(id: number): Promise<boolean>
  cantonExistsInProvince(cantonId: number, provinceId: number): Promise<boolean>
}

export const LOCATION_READ_REPOSITORY = Symbol('LOCATION_READ_REPOSITORY')
