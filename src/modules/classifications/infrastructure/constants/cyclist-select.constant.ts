export const CYCLIST_LIST_SELECT = {
  id: true,
  photo_id: true,
  source: true,
  plate_number: { select: { number: true } },
  _count: { select: { equipment_colors: true } },
  created_at: true,
  updated_at: true,
} as const

export const CYCLIST_DETAIL_SELECT = {
  id: true,
  photo_id: true,
  source: true,
  plate_number: {
    select: {
      id: true,
      number: true,
      confidence_score: true,
      manually_corrected: true,
      corrected_at: true,
    },
  },
  equipment_colors: {
    select: {
      id: true,
      item_type: true,
      color_name: true,
      color_hex: true,
      raw_hex: true,
      density_percentage: true,
    },
  },
  created_at: true,
  updated_at: true,
} as const

export type CyclistListSelect = {
  id: string
  photo_id: string
  source: string
  plate_number: { number: number } | null
  _count: { equipment_colors: number }
  created_at: Date
  updated_at: Date
}

export type CyclistDetailSelect = {
  id: string
  photo_id: string
  source: string
  plate_number: {
    id: string
    number: number
    confidence_score: import('@generated/prisma/client').Prisma.Decimal | null
    manually_corrected: boolean
    corrected_at: Date | null
  } | null
  equipment_colors: Array<{
    id: string
    item_type: string
    color_name: string
    color_hex: string
    raw_hex: string | null
    density_percentage: import('@generated/prisma/client').Prisma.Decimal | null
  }>
  created_at: Date
  updated_at: Date
}

/** Prisma select fragment to include detected_cyclists inside a Photo query. */
export const CLASSIFICATION_DETAIL_SELECT = {
  detected_cyclists: { select: CYCLIST_DETAIL_SELECT },
} as const

/** Type alias used by photo mapper for nested detected_cyclists. */
export type ClassificationDetailSelect = CyclistDetailSelect
