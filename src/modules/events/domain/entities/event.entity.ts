import { AppException, AuditFields } from '@shared/domain'
import slugify from 'slugify'
import { EventStatus, type EventStatusType } from '../value-objects/event-status.vo'

export class Event {
  constructor(
    public readonly id: string,
    public name: string,
    public slug: string,
    public startDate: Date,
    public endDate: Date,
    public provinceId: number | null,
    public cantonId: number | null,
    public eventTypeId: number,
    public status: EventStatusType,
    public readonly audit: AuditFields,
  ) {}

  static create(data: {
    name: string
    startDate: Date
    endDate: Date
    provinceId: number | null
    cantonId: number | null
    eventTypeId: number
  }): Event {
    Event.validateName(data.name)
    Event.validateDateRange(data.startDate, data.endDate)

    return new Event(
      crypto.randomUUID(),
      data.name,
      Event.generateSlug(data.name),
      data.startDate,
      data.endDate,
      data.provinceId,
      data.cantonId,
      data.eventTypeId,
      EventStatus.ACTIVE,
      AuditFields.initialize(),
    )
  }

  update(data: {
    name?: string
    startDate?: Date
    endDate?: Date
    provinceId?: number | null
    cantonId?: number | null
    eventTypeId?: number
  }): void {
    if (data.name !== undefined) {
      Event.validateName(data.name)
      this.name = data.name
    }

    const nextStart = data.startDate ?? this.startDate
    const nextEnd = data.endDate ?? this.endDate
    if (data.startDate !== undefined || data.endDate !== undefined) {
      Event.validateDateRange(nextStart, nextEnd)
      this.startDate = nextStart
      this.endDate = nextEnd
    }

    if (data.provinceId !== undefined) this.provinceId = data.provinceId
    if (data.cantonId !== undefined) this.cantonId = data.cantonId
    if (data.eventTypeId !== undefined) this.eventTypeId = data.eventTypeId

    this.audit.markUpdated()
  }

  archive(): void {
    if (this.status === EventStatus.ARCHIVED) {
      throw AppException.businessRule('event.already_archived')
    }
    this.status = EventStatus.ARCHIVED
    this.audit.markDeleted()
  }

  restore(): void {
    if (this.status !== EventStatus.ARCHIVED) {
      throw AppException.businessRule('event.not_archived')
    }
    this.status = EventStatus.ACTIVE
    this.audit.deletedAt = null
    this.audit.markUpdated()
  }

  static generateSlug(name: string): string {
    return slugify(name, { lower: true, strict: true, locale: 'es' })
  }

  private static validateName(name: string): void {
    if (name.length < 3 || name.length > 200) {
      throw AppException.businessRule('event.name_invalid_length')
    }
  }

  private static validateDateRange(startDate: Date, endDate: Date): void {
    if (endDate < startDate) {
      throw AppException.businessRule('event.date_range_invalid')
    }
  }

  static fromPersistence(data: {
    id: string
    name: string
    slug: string
    startDate: Date
    endDate: Date
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
      data.slug,
      data.startDate,
      data.endDate,
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
