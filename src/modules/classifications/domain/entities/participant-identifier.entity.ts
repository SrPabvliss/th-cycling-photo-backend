export class ParticipantIdentifier {
  constructor(
    public readonly id: string,
    public readonly detectedParticipantId: string,
    public value: string,
    public confidenceScore: number | null,
    public manuallyCorrected: boolean,
    public correctedAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  static create(data: { detectedParticipantId: string; value: string }): ParticipantIdentifier {
    const now = new Date()
    return new ParticipantIdentifier(
      crypto.randomUUID(),
      data.detectedParticipantId,
      data.value,
      null,
      false,
      null,
      now,
      now,
    )
  }

  update(data: { value?: string }): void {
    if (data.value !== undefined) {
      this.value = data.value
      this.updatedAt = new Date()
    }
  }

  static fromPersistence(data: {
    id: string
    detectedParticipantId: string
    value: string
    confidenceScore: number | null
    manuallyCorrected: boolean
    correctedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }): ParticipantIdentifier {
    return new ParticipantIdentifier(
      data.id,
      data.detectedParticipantId,
      data.value,
      data.confidenceScore,
      data.manuallyCorrected,
      data.correctedAt,
      data.createdAt,
      data.updatedAt,
    )
  }
}
