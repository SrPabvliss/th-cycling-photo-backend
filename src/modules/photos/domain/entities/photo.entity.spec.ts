import { AppException } from '@shared/domain'
import { Photo } from './photo.entity'

describe('Photo Entity', () => {
  const validData = {
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    filename: 'photo-001.jpg',
    storageKey: 'events/550e8400/photos/abc123.jpg',
    fileSize: 1024n,
    mimeType: 'image/jpeg',
  }

  describe('create', () => {
    it('should create photo with valid data and pending status', () => {
      const photo = Photo.create(validData)

      expect(photo).toBeInstanceOf(Photo)
      expect(photo.id).toBeDefined()
      expect(photo.eventId).toBe(validData.eventId)
      expect(photo.filename).toBe(validData.filename)
      expect(photo.storageKey).toBe(validData.storageKey)
      expect(photo.fileSize).toBe(1024n)
      expect(photo.mimeType).toBe('image/jpeg')
      expect(photo.status).toBe('pending')
      expect(photo.unclassifiedReason).toBeNull()
      expect(photo.width).toBeNull()
      expect(photo.height).toBeNull()
      expect(photo.capturedAt).toBeNull()
      expect(photo.uploadedAt).toBeInstanceOf(Date)
      expect(photo.processedAt).toBeNull()
    })

    it('should create photo with optional width and height', () => {
      const photo = Photo.create({ ...validData, width: 1920, height: 1080 })

      expect(photo.width).toBe(1920)
      expect(photo.height).toBe(1080)
    })

    it('should create photo with optional capturedAt', () => {
      const capturedAt = new Date('2026-01-15')
      const photo = Photo.create({ ...validData, capturedAt })

      expect(photo.capturedAt).toBe(capturedAt)
    })

    it('should accept image/png mime type', () => {
      const photo = Photo.create({ ...validData, mimeType: 'image/png' })
      expect(photo.mimeType).toBe('image/png')
    })

    it('should accept image/webp mime type', () => {
      const photo = Photo.create({ ...validData, mimeType: 'image/webp' })
      expect(photo.mimeType).toBe('image/webp')
    })

    it('should throw for empty filename', () => {
      expect(() => Photo.create({ ...validData, filename: '' })).toThrow(AppException)
      expect(() => Photo.create({ ...validData, filename: '' })).toThrow('photo.filename_empty')
    })

    it('should throw for whitespace-only filename', () => {
      expect(() => Photo.create({ ...validData, filename: '   ' })).toThrow(AppException)
      expect(() => Photo.create({ ...validData, filename: '   ' })).toThrow('photo.filename_empty')
    })

    it('should throw for invalid mime type', () => {
      expect(() => Photo.create({ ...validData, mimeType: 'image/gif' })).toThrow(AppException)
      expect(() => Photo.create({ ...validData, mimeType: 'image/gif' })).toThrow(
        'photo.invalid_mime_type',
      )
    })

    it('should throw for zero file size', () => {
      expect(() => Photo.create({ ...validData, fileSize: 0n })).toThrow(AppException)
      expect(() => Photo.create({ ...validData, fileSize: 0n })).toThrow('photo.invalid_file_size')
    })

    it('should throw for negative file size', () => {
      expect(() => Photo.create({ ...validData, fileSize: -1n })).toThrow(AppException)
      expect(() => Photo.create({ ...validData, fileSize: -1n })).toThrow('photo.invalid_file_size')
    })
  })

  describe('markAsCompleted', () => {
    it('should set status to completed and processedAt', () => {
      const photo = Photo.create(validData)

      photo.markAsCompleted()

      expect(photo.status).toBe('completed')
      expect(photo.processedAt).toBeInstanceOf(Date)
      expect(photo.unclassifiedReason).toBeNull()
    })
  })

  describe('markAsFailed', () => {
    it('should set status to failed with reason and processedAt', () => {
      const photo = Photo.create(validData)

      photo.markAsFailed('no_cyclist')

      expect(photo.status).toBe('failed')
      expect(photo.unclassifiedReason).toBe('no_cyclist')
      expect(photo.processedAt).toBeInstanceOf(Date)
    })
  })

  describe('fromPersistence', () => {
    it('should reconstitute entity without validations', () => {
      const photo = Photo.fromPersistence({
        id: '550e8400-e29b-41d4-a716-446655440000',
        eventId: '660e8400-e29b-41d4-a716-446655440000',
        filename: 'test.jpg',
        storageKey: 'events/660e8400/photos/test.jpg',
        fileSize: 5000n,
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        status: 'completed',
        unclassifiedReason: null,
        capturedAt: new Date('2026-01-10'),
        uploadedAt: new Date('2026-01-15'),
        processedAt: new Date('2026-01-15'),
      })

      expect(photo).toBeInstanceOf(Photo)
      expect(photo.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(photo.status).toBe('completed')
      expect(photo.width).toBe(800)
      expect(photo.height).toBe(600)
      expect(photo.processedAt).toBeInstanceOf(Date)
    })

    it('should reconstitute failed photo with unclassified reason', () => {
      const photo = Photo.fromPersistence({
        id: '550e8400-e29b-41d4-a716-446655440000',
        eventId: '660e8400-e29b-41d4-a716-446655440000',
        filename: 'test.jpg',
        storageKey: 'events/660e8400/photos/test.jpg',
        fileSize: 5000n,
        mimeType: 'image/jpeg',
        width: null,
        height: null,
        status: 'failed',
        unclassifiedReason: 'ocr_failed',
        capturedAt: null,
        uploadedAt: new Date('2026-01-15'),
        processedAt: new Date('2026-01-15'),
      })

      expect(photo.status).toBe('failed')
      expect(photo.unclassifiedReason).toBe('ocr_failed')
    })
  })
})
