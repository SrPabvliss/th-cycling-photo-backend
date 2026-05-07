import { AppException } from '@shared/domain'
import { COLOR_PALETTE, ColorName } from './color-name.vo'

describe('ColorName', () => {
  it('contains exactly 15 palette values', () => {
    expect(COLOR_PALETTE).toHaveLength(15)
  })
  it('parses valid color', () => {
    expect(ColorName.fromValue('rojo').value).toBe('rojo')
    expect(ColorName.fromValue('plateado').value).toBe('plateado')
  })
  it('rejects invalid color', () => {
    expect(() => ColorName.fromValue('verde-fluor')).toThrow(AppException)
  })
})
