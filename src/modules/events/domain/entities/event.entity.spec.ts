import { AppException } from '@shared/domain'
import { Event } from './event.entity'

describe('Event Entity', () => {
  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const validData = {
    name: 'Vuelta Ciclística de Ambato',
    description: null as string | null,
    date: futureDate,
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
      expect(event.date).toBe(futureDate)
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

    it('should throw for date in the past', () => {
      const pastDate = new Date('2020-01-01')

      expect(() => Event.create({ ...validData, date: pastDate })).toThrow(AppException)
      expect(() => Event.create({ ...validData, date: pastDate })).toThrow('event.date_in_past')
    })

    it('should accept today as event date', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)

      const event = Event.create({ ...validData, date: today })
      expect(event.date).toBe(today)
    })
  })

  describe('update', () => {
    it('should update name and regenerate slug', () => {
      const event = Event.create(validData)
      event.update({ name: 'New Name' })

      expect(event.name).toBe('New Name')
      expect(event.slug).toBe('new-name')
    })

    it('should update date when valid', () => {
      const event = Event.create(validData)
      const newDate = new Date()
      newDate.setFullYear(newDate.getFullYear() + 2)

      event.update({ date: newDate })

      expect(event.date).toBe(newDate)
    })

    it('should throw for invalid name on update', () => {
      const event = Event.create(validData)

      expect(() => event.update({ name: 'AB' })).toThrow(AppException)
      expect(() => event.update({ name: 'AB' })).toThrow('event.name_invalid_length')
    })

    it('should throw for past date on update', () => {
      const event = Event.create(validData)

      expect(() => event.update({ date: new Date('2020-01-01') })).toThrow(AppException)
      expect(() => event.update({ date: new Date('2020-01-01') })).toThrow('event.date_in_past')
    })

    it('should not modify fields not provided', () => {
      const event = Event.create(validData)
      const originalDate = event.date

      event.update({ name: 'Only Name Changed' })

      expect(event.name).toBe('Only Name Changed')
      expect(event.date).toBe(originalDate)
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
      const pastDate = new Date('2020-01-01')
      const event = Event.fromPersistence({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Past Event',
        slug: 'past-event',
        description: null,
        date: pastDate,
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
      expect(event.date).toBe(pastDate)
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
        description: null,
        date: new Date('2024-01-01'),
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
})
