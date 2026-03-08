import { type ILocationReadRepository, LOCATION_READ_REPOSITORY } from '@locations/domain/ports'
import { Inject, Injectable } from '@nestjs/common'
import { AppException } from '@shared/domain'

@Injectable()
export class LocationValidator {
  constructor(
    @Inject(LOCATION_READ_REPOSITORY) private readonly locationRepo: ILocationReadRepository,
  ) {}

  /** Validates that a province/canton combination is consistent and exists. */
  async validate(provinceId: number | null, cantonId: number | null): Promise<void> {
    if (cantonId && !provinceId) {
      throw AppException.businessRule('event.canton_requires_province')
    }

    if (provinceId) {
      const exists = await this.locationRepo.provinceExists(provinceId)
      if (!exists) throw AppException.businessRule('event.province_not_found')
    }

    if (provinceId && cantonId) {
      const exists = await this.locationRepo.cantonExistsInProvince(cantonId, provinceId)
      if (!exists) throw AppException.businessRule('event.canton_not_in_province')
    }
  }
}
