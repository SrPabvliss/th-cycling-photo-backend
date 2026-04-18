export class GearColor {
  constructor(
    public readonly id: string,
    public readonly detectedParticipantId: string,
    public gearTypeId: number,
    public colorName: string,
    public colorHex: string,
    public rawHex: string | null,
    public densityPercentage: number | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  static create(data: {
    detectedParticipantId: string
    gearTypeId: number
    colorName: string
    colorHex: string
  }): GearColor {
    const now = new Date()
    return new GearColor(
      crypto.randomUUID(),
      data.detectedParticipantId,
      data.gearTypeId,
      data.colorName,
      data.colorHex,
      null,
      null,
      now,
      now,
    )
  }

  static fromPersistence(data: {
    id: string
    detectedParticipantId: string
    gearTypeId: number
    colorName: string
    colorHex: string
    rawHex: string | null
    densityPercentage: number | null
    createdAt: Date
    updatedAt: Date
  }): GearColor {
    return new GearColor(
      data.id,
      data.detectedParticipantId,
      data.gearTypeId,
      data.colorName,
      data.colorHex,
      data.rawHex,
      data.densityPercentage,
      data.createdAt,
      data.updatedAt,
    )
  }
}
