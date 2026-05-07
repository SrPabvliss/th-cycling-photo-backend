import { AppException } from '@shared/domain'

export const COLOR_PALETTE = [
  'rojo',
  'naranja',
  'amarillo',
  'verde',
  'azul',
  'celeste',
  'morado',
  'rosa',
  'fucsia',
  'marron',
  'negro',
  'gris',
  'blanco',
  'dorado',
  'plateado',
] as const

export type ColorNameValue = (typeof COLOR_PALETTE)[number]

export class ColorName {
  private constructor(public readonly value: ColorNameValue) {}

  static fromValue(v: string): ColorName {
    if (!COLOR_PALETTE.includes(v as ColorNameValue)) {
      throw AppException.businessRule('color_name.invalid', false, {
        received: v,
        palette: COLOR_PALETTE,
      })
    }
    return new ColorName(v as ColorNameValue)
  }
}
