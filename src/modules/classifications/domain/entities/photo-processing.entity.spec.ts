import { ProcessingStatus } from '@generated/prisma/client'
import { PhotoProcessing } from './photo-processing.entity'

describe('PhotoProcessing', () => {
  it('creates with running status by default', () => {
    const p = PhotoProcessing.create({
      photoId: 'photo-1',
      schemaVersion: '1.0',
      modelVersions: { detection: 'yolo', ocr: 'parseq', color: 'gemini' },
    })
    expect(p.status).toBe(ProcessingStatus.running)
    expect(p.photoId).toBe('photo-1')
    expect(p.schemaVersion).toBe('1.0')
    expect(p.totalMs).toBe(0)
    expect(p.completedAt).toBeNull()
  })

  it('completes successfully', () => {
    const p = PhotoProcessing.create({
      photoId: 'photo-1',
      schemaVersion: '1.0',
      modelVersions: { detection: 'yolo', ocr: 'parseq', color: 'gemini' },
    })
    p.markCompleted({ totalMs: 5722 })
    expect(p.status).toBe(ProcessingStatus.completed)
    expect(p.totalMs).toBe(5722)
    expect(p.completedAt).toBeInstanceOf(Date)
  })

  it('fails with error message', () => {
    const p = PhotoProcessing.create({
      photoId: 'photo-1',
      schemaVersion: '1.0',
      modelVersions: { detection: 'yolo', ocr: 'parseq', color: 'gemini' },
    })
    p.markFailed({ errorMessage: 'image_id mismatch' })
    expect(p.status).toBe(ProcessingStatus.failed)
    expect(p.errorMessage).toBe('image_id mismatch')
  })
})
