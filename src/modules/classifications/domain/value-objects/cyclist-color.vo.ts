/**
 * Predefined color palette for manual classification.
 * Colors are mapped to their closest W3C counterparts
 * for compatibility with Clarifai's color recognition output.
 */
export const CyclistColor = {
  BLACK: { name: 'Black', hex: '#000000' },
  WHITE: { name: 'White', hex: '#FFFFFF' },
  GRAY: { name: 'Gray', hex: '#808080' },
  RED: { name: 'Red', hex: '#FF0000' },
  DARK_RED: { name: 'DarkRed', hex: '#8B0000' },
  ORANGE: { name: 'Orange', hex: '#FFA500' },
  YELLOW: { name: 'Yellow', hex: '#FFFF00' },
  GREEN: { name: 'Green', hex: '#008000' },
  LIME: { name: 'Lime', hex: '#00FF00' },
  BLUE: { name: 'Blue', hex: '#0000FF' },
  NAVY: { name: 'Navy', hex: '#000080' },
  CYAN: { name: 'Cyan', hex: '#00FFFF' },
  PURPLE: { name: 'Purple', hex: '#800080' },
  PINK: { name: 'Pink', hex: '#FFC0CB' },
  BROWN: { name: 'Brown', hex: '#A52A2A' },
} as const

export type CyclistColorEntry = { name: string; hex: string }

/** All valid hex values from the predefined palette. */
export const VALID_COLOR_HEX_VALUES = Object.values(CyclistColor).map((c) => c.hex)
