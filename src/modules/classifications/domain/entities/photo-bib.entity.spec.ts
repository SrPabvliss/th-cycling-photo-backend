import { AttributeSource, BibReadingStatus } from '@generated/prisma/client'
import { PhotoBib } from './photo-bib.entity'

describe('PhotoBib', () => {
  it('createFromAi produces source=ai with all fields populated', () => {
    const bib = PhotoBib.createFromAi({
      photoId: 'photo-1',
      photoProcessingId: 'pp-1',
      digits: '1234',
      confidence: 0.97,
      confidencePerDigit: [0.99, 0.98, 0.97, 0.94],
      status: BibReadingStatus.read,
      rejectionReason: null,
      rawOcrText: '1234',
      bboxSource: [10, 20, 80, 120],
      preprocessingApplied: ['grayscale', 'contrast'],
      processingMs: 150,
      cropPath: null,
    })
    expect(bib.id).toEqual(expect.any(String))
    expect(bib.id.length).toBeGreaterThan(0)
    expect(bib.source).toBe(AttributeSource.ai)
    expect(bib.photoId).toBe('photo-1')
    expect(bib.photoProcessingId).toBe('pp-1')
    expect(bib.digits).toBe('1234')
    expect(bib.confidence).toBe(0.97)
    expect(bib.confidencePerDigit).toEqual([0.99, 0.98, 0.97, 0.94])
    expect(bib.status).toBe(BibReadingStatus.read)
    expect(bib.rejectionReason).toBeNull()
    expect(bib.rawOcrText).toBe('1234')
    expect(bib.bboxSource).toEqual([10, 20, 80, 120])
    expect(bib.preprocessingApplied).toEqual(['grayscale', 'contrast'])
    expect(bib.processingMs).toBe(150)
    expect(bib.createdById).toBeNull()
  })

  describe('cropPath', () => {
    it('createFromAi accepts cropPath and exposes it', () => {
      const bib = PhotoBib.createFromAi({
        photoId: 'p1',
        photoProcessingId: 'pp1',
        digits: '20',
        confidence: 0.95,
        confidencePerDigit: [0.95, 0.95],
        status: BibReadingStatus.read,
        rejectionReason: null,
        rawOcrText: '20',
        bboxSource: [0.1, 0.1, 0.2, 0.2],
        preprocessingApplied: [],
        processingMs: 100,
        cropPath: 'events/e1/photos/p1/crops/bibs/0.jpg',
      })
      expect(bib.cropPath).toBe('events/e1/photos/p1/crops/bibs/0.jpg')
    })

    it('createFromAi accepts null cropPath', () => {
      const bib = PhotoBib.createFromAi({
        photoId: 'p1',
        photoProcessingId: 'pp1',
        digits: '20',
        confidence: 0.95,
        confidencePerDigit: [0.95, 0.95],
        status: BibReadingStatus.read,
        rejectionReason: null,
        rawOcrText: '20',
        bboxSource: [0.1, 0.1, 0.2, 0.2],
        preprocessingApplied: [],
        processingMs: 100,
        cropPath: null,
      })
      expect(bib.cropPath).toBeNull()
    })

    it('fromPersistence round-trips cropPath', () => {
      const bib = PhotoBib.fromPersistence({
        id: 'b1',
        photoId: 'p1',
        photoProcessingId: 'pp1',
        source: AttributeSource.ai,
        digits: '20',
        confidence: 0.95,
        confidencePerDigit: [0.95, 0.95],
        status: BibReadingStatus.read,
        rejectionReason: null,
        rawOcrText: '20',
        bboxSource: [0.1, 0.1, 0.2, 0.2],
        preprocessingApplied: [],
        processingMs: 100,
        createdById: null,
        cropPath: 'events/e1/photos/p1/crops/bibs/0.jpg',
      })
      expect(bib.cropPath).toBe('events/e1/photos/p1/crops/bibs/0.jpg')
    })
  })

  describe('createManual', () => {
    it('creates a reviewer-sourced bib with null processing fields', () => {
      const bib = PhotoBib.createManual({
        photoId: 'photo-1',
        digits: '42',
        status: BibReadingStatus.read,
        reviewerId: 'reviewer-1',
      })
      expect(bib.id).toBeDefined()
      expect(bib.photoId).toBe('photo-1')
      expect(bib.photoProcessingId).toBeNull()
      expect(bib.source).toBe(AttributeSource.reviewer)
      expect(bib.digits).toBe('42')
      expect(bib.confidence).toBeNull()
      expect(bib.confidencePerDigit).toBeNull()
      expect(bib.status).toBe(BibReadingStatus.read)
      expect(bib.cropPath).toBeNull()
      expect(bib.createdById).toBe('reviewer-1')
    })

    it('defaults status to read when not provided', () => {
      const bib = PhotoBib.createManual({
        photoId: 'photo-1',
        digits: '7',
        reviewerId: 'reviewer-1',
      })
      expect(bib.status).toBe(BibReadingStatus.read)
    })
  })
})
