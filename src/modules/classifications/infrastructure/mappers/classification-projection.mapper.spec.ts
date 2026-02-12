import type { ClassificationDetailSelect } from '@classifications/infrastructure/constants'
import { toDetectedCyclistProjection } from './classification-projection.mapper'

/** Helper to create a DecimalLike stub (mimics Prisma Decimal coercion via Number()). */
const decimal = (value: number) => ({ toNumber: () => value, valueOf: () => value })

describe('toDetectedCyclistProjection', () => {
  it('should map a full record with plate number and equipment colors', () => {
    const record: ClassificationDetailSelect = {
      id: 'cyclist-001',
      bounding_box: { x: 10, y: 20, width: 100, height: 200 },
      confidence_score: decimal(0.95),
      plate_number: {
        number: 42,
        confidence_score: decimal(0.88),
        manually_corrected: false,
      },
      equipment_colors: [
        {
          item_type: 'jersey',
          color_name: 'Red',
          color_hex: '#FF0000',
          density_percentage: decimal(0.65),
        },
        {
          item_type: 'shorts',
          color_name: 'Black',
          color_hex: '#000000',
          density_percentage: decimal(0.35),
        },
      ],
    }

    const result = toDetectedCyclistProjection(record)

    expect(result).toEqual({
      id: 'cyclist-001',
      boundingBox: { x: 10, y: 20, width: 100, height: 200 },
      confidenceScore: 0.95,
      plateNumber: {
        number: 42,
        confidenceScore: 0.88,
        manuallyCorrected: false,
      },
      equipmentColors: [
        { itemType: 'jersey', colorName: 'Red', colorHex: '#FF0000', densityPercentage: 0.65 },
        { itemType: 'shorts', colorName: 'Black', colorHex: '#000000', densityPercentage: 0.35 },
      ],
    })
  })

  it('should map null plate number correctly', () => {
    const record: ClassificationDetailSelect = {
      id: 'cyclist-002',
      bounding_box: { x: 0, y: 0, width: 50, height: 100 },
      confidence_score: decimal(0.72),
      plate_number: null,
      equipment_colors: [],
    }

    const result = toDetectedCyclistProjection(record)

    expect(result.plateNumber).toBeNull()
    expect(result.equipmentColors).toEqual([])
    expect(result.confidenceScore).toBe(0.72)
  })

  it('should map null plate confidence score correctly', () => {
    const record: ClassificationDetailSelect = {
      id: 'cyclist-003',
      bounding_box: { x: 5, y: 5, width: 80, height: 160 },
      confidence_score: decimal(0.85),
      plate_number: {
        number: 7,
        confidence_score: null,
        manually_corrected: true,
      },
      equipment_colors: [],
    }

    const result = toDetectedCyclistProjection(record)

    expect(result.plateNumber).toEqual({
      number: 7,
      confidenceScore: null,
      manuallyCorrected: true,
    })
  })
})
