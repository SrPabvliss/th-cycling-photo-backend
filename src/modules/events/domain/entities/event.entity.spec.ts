import { AppException } from '../../../../shared/domain/exceptions/app.exception'
import { Event } from './event.entity'

describe('Event Entity', () => {
  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const validData = {
    name: 'Vuelta Ciclística de Ambato',
    date: futureDate,
    location: 'Ambato, Ecuador',
  }

  describe('create', () => {
    it('should create event with valid data and draft status', () => {
      const event = Event.create(validData)

      expect(event).toBeInstanceOf(Event)
      expect(event.id).toBeDefined()
      expect(event.name).toBe(validData.name)
      expect(event.date).toBe(futureDate)
      expect(event.location).toBe('Ambato, Ecuador')
      expect(event.status).toBe('draft')
      expect(event.totalPhotos).toBe(0)
      expect(event.processedPhotos).toBe(0)
      expect(event.audit.deletedAt).toBeNull()
      expect(event.audit.isDeleted).toBe(false)
      expect(event.audit.createdAt).toBeInstanceOf(Date)
    })

    it('should create event with null location', () => {
      const event = Event.create({ ...validData, location: null })

      expect(event.location).toBeNull()
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
    it('should update name when valid', () => {
      const event = Event.create(validData)
      event.update({ name: 'New Name' })

      expect(event.name).toBe('New Name')
    })

    it('should update date when valid', () => {
      const event = Event.create(validData)
      const newDate = new Date()
      newDate.setFullYear(newDate.getFullYear() + 2)

      event.update({ date: newDate })

      expect(event.date).toBe(newDate)
    })

    it('should update location to null', () => {
      const event = Event.create(validData)
      event.update({ location: null })

      expect(event.location).toBeNull()
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
      const originalLocation = event.location

      event.update({ name: 'Only Name Changed' })

      expect(event.name).toBe('Only Name Changed')
      expect(event.date).toBe(originalDate)
      expect(event.location).toBe(originalLocation)
    })

    it('should update updatedAt timestamp via audit', () => {
      const event = Event.create(validData)
      const originalUpdatedAt = event.audit.updatedAt

      event.update({ name: 'Updated' })

      expect(event.audit.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime())
    })
  })

  describe('softDelete', () => {
    it('should mark event as deleted via audit', () => {
      const event = Event.create(validData)
      const beforeDelete = event.audit.updatedAt

      event.softDelete()

      expect(event.audit.deletedAt).toBeInstanceOf(Date)
      expect(event.audit.isDeleted).toBe(true)
      expect(event.audit.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime())
    })
  })

  describe('fromPersistence', () => {
    it('should reconstitute entity without validations', () => {
      const pastDate = new Date('2020-01-01')
      const event = Event.fromPersistence({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Past Event',
        date: pastDate,
        location: null,
        status: 'completed',
        totalPhotos: 100,
        processedPhotos: 95,
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-06-01'),
        deletedAt: null,
      })

      expect(event).toBeInstanceOf(Event)
      expect(event.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(event.date).toBe(pastDate)
      expect(event.status).toBe('completed')
      expect(event.totalPhotos).toBe(100)
      expect(event.audit.deletedAt).toBeNull()
      expect(event.audit.isDeleted).toBe(false)
    })

    it('should reconstitute soft-deleted entity', () => {
      const deletedDate = new Date('2024-06-15')
      const event = Event.fromPersistence({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Deleted Event',
        date: new Date('2024-01-01'),
        location: null,
        status: 'draft',
        totalPhotos: 0,
        processedPhotos: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-15'),
        deletedAt: deletedDate,
      })

      expect(event.audit.deletedAt).toBe(deletedDate)
      expect(event.audit.isDeleted).toBe(true)
    })
  })
})
