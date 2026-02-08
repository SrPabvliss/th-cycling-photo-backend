/**
 * Encapsulates audit timestamps for domain entities.
 * Composed into entities that need creation, update, and soft-delete tracking.
 */
export class AuditFields {
  constructor(
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  /** Creates audit fields for a brand-new entity. */
  static initialize(): AuditFields {
    const now = new Date()
    return new AuditFields(now, now, null)
  }

  /** Reconstitutes audit fields from persisted data (no validations). */
  static fromPersistence(data: {
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
  }): AuditFields {
    return new AuditFields(data.createdAt, data.updatedAt, data.deletedAt)
  }

  /** Whether this entity has been soft-deleted. */
  get isDeleted(): boolean {
    return this.deletedAt !== null
  }

  /** Marks the entity as updated (refreshes updatedAt). */
  markUpdated(): void {
    this.updatedAt = new Date()
  }

  /** Marks the entity as soft-deleted. */
  markDeleted(): void {
    this.deletedAt = new Date()
    this.updatedAt = new Date()
  }
}
