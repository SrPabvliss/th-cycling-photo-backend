import { ColorRegion } from '@generated/prisma/client'
import { AppException } from '@shared/domain'
import { ColorRegionVo } from './color-region.vo'

describe('ColorRegionVo', () => {
  it('parses valid region', () => {
    expect(ColorRegionVo.fromValue('helmet').value).toBe(ColorRegion.helmet)
    expect(ColorRegionVo.fromValue('cyclist_clothes').value).toBe(ColorRegion.cyclist_clothes)
    expect(ColorRegionVo.fromValue('bicycle').value).toBe(ColorRegion.bicycle)
  })
  it('rejects invalid', () => {
    expect(() => ColorRegionVo.fromValue('shoes')).toThrow(AppException)
  })
})
