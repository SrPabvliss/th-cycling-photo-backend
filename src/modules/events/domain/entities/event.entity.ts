import { AppException, AuditFields } from '@shared/domain'
import { EventStatus, type EventStatusType } from '../value-objects/event-status.vo'

export class Event {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string | null,
    public date: Date,
    public location: string | null,
    public provinceId: number | null,
    public cantonId: number | null,
    public coverImageUrl: string | null,
    public coverImageStorageKey: string | null,
    public status: EventStatusType,
    public readonly audit: AuditFields,
  ) {}

  /**
   * Factory method for creating a new event.
   * Applies all business validations before instantiation.
   *
   * @param data - Event creation data (name, date, location)
   * @returns New Event instance with active status
   * @throws AppException.businessRule if name length is not between 3 and 200
   * @throws AppException.businessRule if date is in the past
   */
  static create(data: {
    name: string
    description: string | null
    date: Date
    location: string | null
    provinceId: number | null
    cantonId: number | null
  }): Event {
    Event.validateName(data.name)
    Event.validateDate(data.date)

    return new Event(
      crypto.randomUUID(),
      data.name,
      data.description,
      data.date,
      data.location,
      data.provinceId,
      data.cantonId,
      null,
      null,
      EventStatus.ACTIVE,
      AuditFields.initialize(),
    )
  }

  /**
   * Updates mutable event fields with business validations.
   *
   * @param data - Partial update data
   * @throws AppException.businessRule if name length is not between 3 and 200
   * @throws AppException.businessRule if date is in the past
   */
  update(data: {
    name?: string
    description?: string | null
    date?: Date
    location?: string | null
    provinceId?: number | null
    cantonId?: number | null
  }): void {
    if (data.name !== undefined) {
      Event.validateName(data.name)
      this.name = data.name
    }

    if (data.description !== undefined) this.description = data.description

    if (data.date !== undefined) {
      Event.validateDate(data.date)
      this.date = data.date
    }

    if (data.location !== undefined) this.location = data.location
    if (data.provinceId !== undefined) this.provinceId = data.provinceId
    if (data.cantonId !== undefined) this.cantonId = data.cantonId

    this.audit.markUpdated()
  }

  /** Sets the manual cover image for this event. */
  setCoverImage(url: string, storageKey: string): void {
    this.coverImageUrl = url
    this.coverImageStorageKey = storageKey
    this.audit.markUpdated()
  }

  /** Removes the manual cover image from this event. */
  removeCoverImage(): void {
    this.coverImageUrl = null
    this.coverImageStorageKey = null
    this.audit.markUpdated()
  }

  /** Archives this event: sets status to archived and marks as soft-deleted. */
  archive(): void {
    if (this.status === EventStatus.ARCHIVED) {
      throw AppException.businessRule('event.already_archived')
    }
    this.status = EventStatus.ARCHIVED
    this.audit.markDeleted()
  }

  /** Restores a previously archived event: sets status to active and clears deletedAt. */
  restore(): void {
    if (this.status !== EventStatus.ARCHIVED) {
      throw AppException.businessRule('event.not_archived')
    }
    this.status = EventStatus.ACTIVE
    this.audit.deletedAt = null
    this.audit.markUpdated()
  }

  private static validateName(name: string): void {
    if (name.length < 3 || name.length > 200) {
      throw AppException.businessRule('event.name_invalid_length')
    }
  }

  private static validateDate(date: Date): void {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) throw AppException.businessRule('event.date_in_past')
  }

  /**
   * Reconstitutes an entity from persistence data.
   * No validations are applied – the data is trusted.
   */
  static fromPersistence(data: {
    id: string
    name: string
    description: string | null
    date: Date
    location: string | null
    provinceId: number | null
    cantonId: number | null
    coverImageUrl: string | null
    coverImageStorageKey: string | null
    status: EventStatusType
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    createdById?: string | null
    updatedById?: string | null
  }): Event {
    return new Event(
      data.id,
      data.name,
      data.description,
      data.date,
      data.location,
      data.provinceId,
      data.cantonId,
      data.coverImageUrl,
      data.coverImageStorageKey,
      data.status,
      AuditFields.fromPersistence({
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        deletedAt: data.deletedAt,
        createdById: data.createdById,
        updatedById: data.updatedById,
      }),
    )
  }
}
