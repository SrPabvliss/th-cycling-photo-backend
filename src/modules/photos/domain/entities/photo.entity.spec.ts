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
      expect(photo.width).toBeNull()
      expect(photo.height).toBeNull()
      expect(photo.capturedAt).toBeNull()
      expect(photo.uploadedAt).toBeInstanceOf(Date)
      expect(photo.processedAt).toBeNull()
      expect(photo.reviewedAt).toBeNull()
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

  describe('markProcessing', () => {
    it('should set status to processing', () => {
      const photo = Photo.create(validData)
      photo.markProcessing()
      expect(photo.status).toBe('processing')
    })
  })

  describe('markProcessed', () => {
    it('should set status, processedAt, width and height', () => {
      const photo = Photo.create(validData)
      photo.markProcessed(1920, 1080)
      expect(photo.status).toBe('processed')
      expect(photo.processedAt).toBeInstanceOf(Date)
      expect(photo.width).toBe(1920)
      expect(photo.height).toBe(1080)
    })

    it('should not overwrite width/height when nulls passed', () => {
      const photo = Photo.create({ ...validData, width: 800, height: 600 })
      photo.markProcessed(null, null)
      expect(photo.status).toBe('processed')
      expect(photo.width).toBe(800)
      expect(photo.height).toBe(600)
    })
  })

  describe('markFailed', () => {
    it('should set status to failed and processedAt', () => {
      const photo = Photo.create(validData)
      photo.markFailed()
      expect(photo.status).toBe('failed')
      expect(photo.processedAt).toBeInstanceOf(Date)
    })
  })

  describe('markReviewed', () => {
    it('should set status to reviewed and reviewedAt', () => {
      const photo = Photo.create(validData)
      photo.markReviewed()
      expect(photo.status).toBe('reviewed')
      expect(photo.reviewedAt).toBeInstanceOf(Date)
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
        status: 'processed',
        capturedAt: new Date('2026-01-10'),
        uploadedAt: new Date('2026-01-15'),
        processedAt: new Date('2026-01-15'),
        reviewedAt: null,
        publicSlug: 'test-slug',
        retouchedStorageKey: null,
        retouchedPublicSlug: null,
        retouchedFileSize: null,
        retouchedAt: null,
      })

      expect(photo).toBeInstanceOf(Photo)
      expect(photo.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(photo.status).toBe('processed')
      expect(photo.width).toBe(800)
      expect(photo.height).toBe(600)
      expect(photo.processedAt).toBeInstanceOf(Date)
      expect(photo.reviewedAt).toBeNull()
    })

    it('should reconstitute reviewed photo with reviewedAt', () => {
      const reviewedAt = new Date('2026-01-16')
      const photo = Photo.fromPersistence({
        id: '550e8400-e29b-41d4-a716-446655440000',
        eventId: '660e8400-e29b-41d4-a716-446655440000',
        filename: 'test.jpg',
        storageKey: 'events/660e8400/photos/test.jpg',
        fileSize: 5000n,
        mimeType: 'image/jpeg',
        width: null,
        height: null,
        status: 'reviewed',
        capturedAt: null,
        uploadedAt: new Date('2026-01-15'),
        processedAt: new Date('2026-01-15'),
        reviewedAt,
        publicSlug: 'test-slug',
        retouchedStorageKey: null,
        retouchedPublicSlug: null,
        retouchedFileSize: null,
        retouchedAt: null,
      })

      expect(photo.status).toBe('reviewed')
      expect(photo.reviewedAt).toBe(reviewedAt)
    })
  })
})
