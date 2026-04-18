import { AppException, AuditFields } from '@shared/domain'
import slugify from 'slugify'
import { EventStatus, type EventStatusType } from '../value-objects/event-status.vo'

export class Event {
  constructor(
    public readonly id: string,
    public name: string,
    public slug: string,
    public description: string | null,
    public date: Date,
    public provinceId: number | null,
    public cantonId: number | null,
    public eventTypeId: number,
    public status: EventStatusType,
    public readonly audit: AuditFields,
  ) {}

  static create(data: {
    name: string
    description: string | null
    date: Date
    provinceId: number | null
    cantonId: number | null
    eventTypeId: number
  }): Event {
    Event.validateName(data.name)
    Event.validateDate(data.date)

    return new Event(
      crypto.randomUUID(),
      data.name,
      Event.generateSlug(data.name),
      data.description,
      data.date,
      data.provinceId,
      data.cantonId,
      data.eventTypeId,
      EventStatus.ACTIVE,
      AuditFields.initialize(),
    )
  }

  update(data: {
    name?: string
    description?: string | null
    date?: Date
    provinceId?: number | null
    cantonId?: number | null
    eventTypeId?: number
  }): void {
    if (data.name !== undefined) {
      Event.validateName(data.name)
      this.name = data.name
      this.slug = Event.generateSlug(data.name)
    }

    if (data.description !== undefined) this.description = data.description

    if (data.date !== undefined) {
      Event.validateDate(data.date)
      this.date = data.date
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

  private static validateDate(date: Date): void {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) throw AppException.businessRule('event.date_in_past')
  }

  static fromPersistence(data: {
    id: string
    name: string
    slug: string
    description: string | null
    date: Date
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
      data.description,
      data.date,
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
