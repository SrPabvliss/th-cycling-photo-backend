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
    public eventTypeId: number,
    public status: EventStatusType,
    public readonly audit: AuditFields,
  ) {}

  /**
   * Factory method for creating a new event.
   * Applies all business validations before instantiation.
   */
  static create(data: {
    name: string
    description: string | null
    date: Date
    location: string | null
    provinceId: number | null
    cantonId: number | null
    eventTypeId: number
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
      data.eventTypeId,
      EventStatus.ACTIVE,
      AuditFields.initialize(),
    )
  }

  /**
   * Updates mutable event fields with business validations.
   */
  update(data: {
    name?: string
    description?: string | null
    date?: Date
    location?: string | null
    provinceId?: number | null
    cantonId?: number | null
    eventTypeId?: number
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
    if (data.eventTypeId !== undefined) this.eventTypeId = data.eventTypeId

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
    eventTypeId: number
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
      data.eventTypeId,
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
