import { AppException } from '@shared/domain'
import { Event } from './event.entity'

describe('Event Entity', () => {
  const futureStart = new Date()
  futureStart.setFullYear(futureStart.getFullYear() + 1)
  const futureEnd = new Date(futureStart)
  futureEnd.setDate(futureEnd.getDate() + 2)

  const validData = {
    name: 'Vuelta Ciclística de Ambato',
    startDate: futureStart,
    endDate: futureEnd,
    provinceId: 18 as number | null,
    cantonId: 1 as number | null,
    eventTypeId: 1,
  }

  describe('create', () => {
    it('should create event with valid data and active status', () => {
      const event = Event.create(validData)

      expect(event).toBeInstanceOf(Event)
      expect(event.id).toBeDefined()
      expect(event.name).toBe(validData.name)
      expect(event.slug).toBe('vuelta-ciclistica-de-ambato')
      expect(event.startDate).toBe(futureStart)
      expect(event.endDate).toBe(futureEnd)
      expect(event.provinceId).toBe(18)
      expect(event.cantonId).toBe(1)
      expect(event.status).toBe('active')
      expect(event.audit.deletedAt).toBeNull()
      expect(event.audit.isDeleted).toBe(false)
      expect(event.audit.createdAt).toBeInstanceOf(Date)
    })

    it('should create event with null provinceId and cantonId', () => {
      const event = Event.create({ ...validData, provinceId: null, cantonId: null })

      expect(event.provinceId).toBeNull()
      expect(event.cantonId).toBeNull()
    })

    it('should throw for name shorter than 3 characters', () => {
      expect(() => Event.create({ ...validData, name: 'AB' })).toThrow(AppException)
      expect(() => Event.create({ ...validData, name: 'AB' })).toThrow('event.name_invalid_length')
    })

    it('should throw for name longer than 200 characters', () => {
      const longName = 'A'.repeat(201)

      expect(() => Event.create({ ...validData, name: longName })).toThrow(AppException)
      expect(() => Event.create({ ...validData, name: longName })).toThrow(
        'event.name_invalid_length',
      )
    })

    it('should accept name with exactly 3 characters', () => {
      const event = Event.create({ ...validData, name: 'ABC' })
      expect(event.name).toBe('ABC')
    })

    it('should accept name with exactly 200 characters', () => {
      const name200 = 'A'.repeat(200)
      const event = Event.create({ ...validData, name: name200 })
      expect(event.name).toBe(name200)
    })
  })

  describe('update', () => {
    it('should update name and regenerate slug', () => {
      const event = Event.create(validData)
      event.update({ name: 'New Name' })

      expect(event.name).toBe('New Name')
      expect(event.slug).toBe('new-name')
    })

    it('should update startDate and endDate when valid', () => {
      const event = Event.create(validData)
      const newStart = new Date()
      newStart.setFullYear(newStart.getFullYear() + 2)
      const newEnd = new Date(newStart)
      newEnd.setDate(newEnd.getDate() + 1)

      event.update({ startDate: newStart, endDate: newEnd })

      expect(event.startDate).toBe(newStart)
      expect(event.endDate).toBe(newEnd)
    })

    it('should throw for invalid name on update', () => {
      const event = Event.create(validData)

      expect(() => event.update({ name: 'AB' })).toThrow(AppException)
      expect(() => event.update({ name: 'AB' })).toThrow('event.name_invalid_length')
    })

    it('should throw when endDate becomes before startDate on update', () => {
      const event = Event.create(validData)
      const earlier = new Date(event.startDate)
      earlier.setDate(earlier.getDate() - 5)

      expect(() => event.update({ endDate: earlier })).toThrow(AppException)
      expect(() => event.update({ endDate: earlier })).toThrow('event.date_range_invalid')
    })

    it('should not modify fields not provided', () => {
      const event = Event.create(validData)
      const originalStart = event.startDate

      event.update({ name: 'Only Name Changed' })

      expect(event.name).toBe('Only Name Changed')
      expect(event.startDate).toBe(originalStart)
    })

    it('should update updatedAt timestamp via audit', () => {
      const event = Event.create(validData)
      const originalUpdatedAt = event.audit.updatedAt

      event.update({ name: 'Updated' })

      expect(event.audit.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime())
    })
  })

  describe('archive', () => {
    it('should set status to archived and mark as deleted', () => {
      const event = Event.create(validData)

      event.archive()

      expect(event.status).toBe('archived')
      expect(event.audit.deletedAt).toBeInstanceOf(Date)
      expect(event.audit.isDeleted).toBe(true)
    })

    it('should throw if event is already archived', () => {
      const event = Event.create(validData)
      event.archive()

      expect(() => event.archive()).toThrow(AppException)
      expect(() => event.archive()).toThrow('event.already_archived')
    })
  })

  describe('restore', () => {
    it('should set status to active and clear deletedAt', () => {
      const event = Event.create(validData)
      event.archive()

      event.restore()

      expect(event.status).toBe('active')
      expect(event.audit.deletedAt).toBeNull()
      expect(event.audit.isDeleted).toBe(false)
    })

    it('should throw if event is not archived', () => {
      const event = Event.create(validData)

      expect(() => event.restore()).toThrow(AppException)
      expect(() => event.restore()).toThrow('event.not_archived')
    })
  })

  describe('fromPersistence', () => {
    it('should reconstitute entity without validations', () => {
      const pastStart = new Date('2020-01-01')
      const pastEnd = new Date('2020-01-02')
      const event = Event.fromPersistence({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Past Event',
        slug: 'past-event',
        startDate: pastStart,
        endDate: pastEnd,
        provinceId: null,
        cantonId: null,
        eventTypeId: 1,
        status: 'active',
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-06-01'),
        deletedAt: null,
      })

      expect(event).toBeInstanceOf(Event)
      expect(event.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(event.startDate).toBe(pastStart)
      expect(event.endDate).toBe(pastEnd)
      expect(event.status).toBe('active')
      expect(event.audit.deletedAt).toBeNull()
      expect(event.audit.isDeleted).toBe(false)
    })

    it('should reconstitute archived entity', () => {
      const deletedDate = new Date('2024-06-15')
      const event = Event.fromPersistence({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Archived Event',
        slug: 'archived-event',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
        provinceId: 18,
        cantonId: 1,
        eventTypeId: 1,
        status: 'archived',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-15'),
        deletedAt: deletedDate,
      })

      expect(event.status).toBe('archived')
      expect(event.audit.deletedAt).toBe(deletedDate)
      expect(event.audit.isDeleted).toBe(true)
    })
  })

  describe('Event entity (TitanTV alignment)', () => {
    const baseInput = {
      name: 'Vuelta al Cotopaxi 2026',
      startDate: new Date('2026-06-15'),
      endDate: new Date('2026-06-17'),
      provinceId: 18,
      cantonId: null,
      eventTypeId: 1,
    }

    it('accepts past start dates', () => {
      const event = Event.create({
        ...baseInput,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2020-01-02'),
      })
      expect(event.startDate).toEqual(new Date('2020-01-01'))
    })

    it('accepts single-day ranges (start === end)', () => {
      const event = Event.create({
        ...baseInput,
        startDate: new Date('2026-06-15'),
        endDate: new Date('2026-06-15'),
      })
      expect(event.endDate).toEqual(event.startDate)
    })

    it('rejects ranges where endDate is before startDate', () => {
      expect(() =>
        Event.create({
          ...baseInput,
          startDate: new Date('2026-06-17'),
          endDate: new Date('2026-06-15'),
        }),
      ).toThrow(/event\.date_range_invalid/)
    })

    it('does not expose description or isFeatured', () => {
      const event = Event.create(baseInput)
      expect((event as unknown as Record<string, unknown>).description).toBeUndefined()
      expect((event as unknown as Record<string, unknown>).isFeatured).toBeUndefined()
    })
  })
})
