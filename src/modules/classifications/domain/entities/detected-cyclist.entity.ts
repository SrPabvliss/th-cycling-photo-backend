export class DetectedCyclist {
  constructor(
    public readonly id: string,
    public readonly photoId: string,
    public readonly boundingBox: Record<string, number>,
    public readonly confidenceScore: number,
    public readonly createdAt: Date,
  ) {}

  static create(data: {
    photoId: string
    boundingBox: Record<string, number>
    confidenceScore: number
  }): DetectedCyclist {
    return new DetectedCyclist(
      crypto.randomUUID(),
      data.photoId,
      data.boundingBox,
      data.confidenceScore,
      new Date(),
    )
  }

  static fromPersistence(data: {
    id: string
    photoId: string
    boundingBox: Record<string, number>
    confidenceScore: number
    createdAt: Date
  }): DetectedCyclist {
    return new DetectedCyclist(
      data.id,
      data.photoId,
      data.boundingBox,
      data.confidenceScore,
      data.createdAt,
    )
  }
}
