export const COLOR_PALETTE = [
  'rojo',
  'azul',
  'negro',
  'blanco',
  'verde',
  'amarillo',
  'naranja',
  'morado',
  'rosa',
  'gris',
  'marron',
  'celeste',
  'fucsia',
  'beige',
  'dorado',
] as const

export type ColorPaletteValue = (typeof COLOR_PALETTE)[number]

export function isColorPaletteValue(value: unknown): value is ColorPaletteValue {
  return typeof value === 'string' && (COLOR_PALETTE as readonly string[]).includes(value)
}
