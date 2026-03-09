import {
  ClassificationSource,
  type ClassificationSourceType,
} from '../value-objects/classification-source.vo'

export class DetectedCyclist {
  constructor(
    public readonly id: string,
    public readonly photoId: string,
    public source: ClassificationSourceType,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  /** Creates a new manually-classified cyclist record. */
  static create(data: { photoId: string }): DetectedCyclist {
    const now = new Date()
    return new DetectedCyclist(
      crypto.randomUUID(),
      data.photoId,
      ClassificationSource.MANUAL,
      now,
      now,
    )
  }

  markUpdated(): void {
    this.updatedAt = new Date()
  }

  static fromPersistence(data: {
    id: string
    photoId: string
    source: ClassificationSourceType
    createdAt: Date
    updatedAt: Date
  }): DetectedCyclist {
    return new DetectedCyclist(data.id, data.photoId, data.source, data.createdAt, data.updatedAt)
  }
}
