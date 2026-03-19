import {
  ClassificationSource,
  type ClassificationSourceType,
} from '../value-objects/classification-source.vo'

export class DetectedCyclist {
  private _createdById: string | null = null
  private _classifiedById: string | null = null

  get createdById(): string | null {
    return this._createdById
  }

  get classifiedById(): string | null {
    return this._classifiedById
  }

  setCreatedBy(userId: string): void {
    this._createdById = userId
  }

  setClassifiedBy(userId: string): void {
    this._classifiedById = userId
  }

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
