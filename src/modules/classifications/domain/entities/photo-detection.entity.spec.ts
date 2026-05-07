import { PhotoDetection } from './photo-detection.entity'

describe('PhotoDetection', () => {
  it('builds with valid bbox and all fields', () => {
    const det = PhotoDetection.create({
      photoId: 'photo-1',
      photoProcessingId: 'pp-1',
      className: 'cyclist',
      classId: 0,
      confidence: 0.92,
      bbox: [10, 20, 100, 200],
    })
    expect(det.id).toEqual(expect.any(String))
    expect(det.id.length).toBeGreaterThan(0)
    expect(det.photoId).toBe('photo-1')
    expect(det.photoProcessingId).toBe('pp-1')
    expect(det.className).toBe('cyclist')
    expect(det.classId).toBe(0)
    expect(det.confidence).toBe(0.92)
    expect(det.bbox).toEqual([10, 20, 100, 200])
  })
})
