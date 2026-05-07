import { ColorRegion } from '@generated/prisma/client'
import { AppException } from '@shared/domain'

export class ColorRegionVo {
  private constructor(public readonly value: ColorRegion) {}

  static fromValue(v: string): ColorRegionVo {
    if (!Object.values(ColorRegion).includes(v as ColorRegion)) {
      throw AppException.businessRule('color_region.invalid', false, { received: v })
    }
    return new ColorRegionVo(v as ColorRegion)
  }
}
