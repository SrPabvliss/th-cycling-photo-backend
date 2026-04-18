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

  /** Validates the full country → province → canton hierarchy.
   *  Province/canton are only validated if the country has them (e.g. Ecuador).
   *  For other countries, province/canton are ignored. */
  async validateFull(
    countryId: number,
    provinceId: number | null,
    cantonId: number | null,
  ): Promise<void> {
    const countryExists = await this.locationRepo.countryExists(countryId)
    if (!countryExists) throw AppException.businessRule('location.country_not_found')

    // Province/canton only apply if provided — other countries don't have them
    if (!provinceId && !cantonId) return

    if (cantonId && !provinceId) {
      throw AppException.businessRule('location.canton_requires_province')
    }

    if (provinceId) {
      const exists = await this.locationRepo.provinceExistsInCountry(provinceId, countryId)
      if (!exists) throw AppException.businessRule('location.province_not_in_country')
    }

    if (provinceId && cantonId) {
      const exists = await this.locationRepo.cantonExistsInProvince(cantonId, provinceId)
      if (!exists) throw AppException.businessRule('location.canton_not_in_province')
    }
  }
}
