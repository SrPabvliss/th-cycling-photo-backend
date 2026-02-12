import { AppException } from '@shared/domain'

export class PlateNumber {
  constructor(
    public readonly id: string,
    public readonly detectedCyclistId: string,
    public readonly number: number,
    public readonly confidenceScore: number | null,
    public readonly manuallyCorrected: boolean,
    public readonly correctedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  static create(data: {
    detectedCyclistId: string
    number: number
    confidenceScore?: number | null
  }): PlateNumber {
    PlateNumber.validateNumber(data.number)

    return new PlateNumber(
      crypto.randomUUID(),
      data.detectedCyclistId,
      data.number,
      data.confidenceScore ?? null,
      false,
      null,
      new Date(),
    )
  }

  private static validateNumber(number: number): void {
    if (number < 1 || number > 999) {
      throw AppException.businessRule('photo.plate_number_out_of_range')
    }
  }

  static fromPersistence(data: {
    id: string
    detectedCyclistId: string
    number: number
    confidenceScore: number | null
    manuallyCorrected: boolean
    correctedAt: Date | null
    createdAt: Date
  }): PlateNumber {
    return new PlateNumber(
      data.id,
      data.detectedCyclistId,
      data.number,
      data.confidenceScore,
      data.manuallyCorrected,
      data.correctedAt,
      data.createdAt,
    )
  }
}
