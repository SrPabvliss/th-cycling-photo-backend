import { AuditFields } from '../../../../shared/domain/audit-fields.js'
import { AppException } from '../../../../shared/domain/exceptions/app.exception.js'
import { EventStatus, type EventStatusType } from '../value-objects/event-status.vo.js'

export class Event {
  constructor(
    public readonly id: string,
    public name: string,
    public date: Date,
    public location: string | null,
    public status: EventStatusType,
    public totalPhotos: number,
    public processedPhotos: number,
    public readonly audit: AuditFields,
  ) {}

  /**
   * Factory method for creating a new event.
   * Applies all business validations before instantiation.
   *
   * @param data - Event creation data (name, date, location)
   * @returns New Event instance with draft status
   * @throws AppException.businessRule if name length is not between 3 and 200
   * @throws AppException.businessRule if date is in the past
   */
  static create(data: { name: string; date: Date; location: string | null }): Event {
    if (data.name.length < 3 || data.name.length > 200) {
      throw AppException.businessRule('event.name_invalid_length')
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (data.date < today) throw AppException.businessRule('event.date_in_past')

    return new Event(
      crypto.randomUUID(),
      data.name,
      data.date,
      data.location,
      EventStatus.DRAFT,
      0,
      0,
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
  update(data: { name?: string; date?: Date; location?: string | null }): void {
    if (data.name !== undefined) {
      if (data.name.length < 3 || data.name.length > 200) {
        throw AppException.businessRule('event.name_invalid_length')
      }
      this.name = data.name
    }

    if (data.date !== undefined) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (data.date < today) throw AppException.businessRule('event.date_in_past')
      this.date = data.date
    }

    if (data.location !== undefined) this.location = data.location

    this.audit.markUpdated()
  }

  /** Marks this event as soft-deleted. */
  softDelete(): void {
    this.audit.markDeleted()
  }

  /**
   * Reconstitutes an entity from persistence data.
   * No validations are applied – the data is trusted.
   */
  static fromPersistence(data: {
    id: string
    name: string
    date: Date
    location: string | null
    status: EventStatusType
    totalPhotos: number
    processedPhotos: number
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
  }): Event {
    return new Event(
      data.id,
      data.name,
      data.date,
      data.location,
      data.status,
      data.totalPhotos,
      data.processedPhotos,
      AuditFields.fromPersistence({
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        deletedAt: data.deletedAt,
      }),
    )
  }
}
