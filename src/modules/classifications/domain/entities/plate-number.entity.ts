import { AppException } from '@shared/domain'

export class PlateNumber {
  constructor(
    public readonly id: string,
    public readonly detectedCyclistId: string,
    public number: number,
    public confidenceScore: number | null,
    public manuallyCorrected: boolean,
    public correctedAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  static create(data: { detectedCyclistId: string; number: number }): PlateNumber {
    PlateNumber.validateNumber(data.number)
    const now = new Date()
    return new PlateNumber(
      crypto.randomUUID(),
      data.detectedCyclistId,
      data.number,
      null,
      false,
      null,
      now,
      now,
    )
  }

  update(data: { number?: number }): void {
    if (data.number !== undefined) {
      PlateNumber.validateNumber(data.number)
      this.number = data.number
      this.updatedAt = new Date()
    }
  }

  private static validateNumber(value: number): void {
    if (!Number.isInteger(value) || value < 1 || value > 9999) {
      throw AppException.businessRule('classification.plate_number_invalid')
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
    updatedAt: Date
  }): PlateNumber {
    return new PlateNumber(
      data.id,
      data.detectedCyclistId,
      data.number,
      data.confidenceScore,
      data.manuallyCorrected,
      data.correctedAt,
      data.createdAt,
      data.updatedAt,
    )
  }
}
