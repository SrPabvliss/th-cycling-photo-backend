/** Prisma Decimal — coercible to number via Number() */
type DecimalLike = { toNumber(): number }

/** Prisma select shape for classification detail (detected_cyclists with nested relations). */
export const CLASSIFICATION_DETAIL_SELECT = {
  detected_cyclists: {
    select: {
      id: true,
      bounding_box: true,
      confidence_score: true,
      plate_number: {
        select: {
          number: true,
          confidence_score: true,
          manually_corrected: true,
        },
      },
      equipment_colors: {
        select: {
          item_type: true,
          color_name: true,
          color_hex: true,
          density_percentage: true,
        },
      },
    },
  },
} as const

/** TypeScript type representing the result shape of CLASSIFICATION_DETAIL_SELECT. */
export type ClassificationDetailSelect = {
  id: string
  bounding_box: unknown
  confidence_score: DecimalLike
  plate_number: {
    number: number
    confidence_score: DecimalLike | null
    manually_corrected: boolean
  } | null
  equipment_colors: {
    item_type: string
    color_name: string
    color_hex: string
    density_percentage: DecimalLike
  }[]
}
