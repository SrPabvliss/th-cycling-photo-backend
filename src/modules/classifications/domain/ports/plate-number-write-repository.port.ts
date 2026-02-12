import type { PlateNumber } from '../entities'

export interface IPlateNumberWriteRepository {
  save(plateNumber: PlateNumber): Promise<PlateNumber>
}

export const PLATE_NUMBER_WRITE_REPOSITORY = Symbol('PLATE_NUMBER_WRITE_REPOSITORY')
