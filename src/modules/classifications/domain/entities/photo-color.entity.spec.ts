import { AttributeSource, ColorRegion } from '@generated/prisma/client'
import { PhotoColor } from './photo-color.entity'

describe('PhotoColor', () => {
  it('createFromAi produces source=ai with region/primary populated', () => {
    const color = PhotoColor.createFromAi({
      photoId: 'photo-1',
      photoProcessingId: 'pp-1',
      region: ColorRegion.cyclist_clothes,
      primaryColor: 'red',
      secondaryColor: 'white',
      confidence: 0.88,
      bboxSource: [5, 10, 60, 90],
      strategy: 'kmeans',
      processingMs: 75,
      cropPath: null,
    })
    expect(color.id).toEqual(expect.any(String))
    expect(color.id.length).toBeGreaterThan(0)
    expect(color.source).toBe(AttributeSource.ai)
    expect(color.photoId).toBe('photo-1')
    expect(color.photoProcessingId).toBe('pp-1')
    expect(color.region).toBe(ColorRegion.cyclist_clothes)
    expect(color.primaryColor).toBe('red')
    expect(color.secondaryColor).toBe('white')
    expect(color.confidence).toBe(0.88)
    expect(color.bboxSource).toEqual([5, 10, 60, 90])
    expect(color.strategy).toBe('kmeans')
    expect(color.processingMs).toBe(75)
    expect(color.createdById).toBeNull()
    expect(color.cropPath).toBeNull()
  })

  describe('cropPath', () => {
    it('createFromAi accepts cropPath and exposes it', () => {
      const color = PhotoColor.createFromAi({
        photoId: 'p1',
        photoProcessingId: 'pp1',
        region: ColorRegion.helmet,
        primaryColor: 'rojo',
        secondaryColor: null,
        confidence: 0.9,
        bboxSource: [0.1, 0.1, 0.2, 0.2],
        strategy: 'gemini-2.5-flash',
        processingMs: 1700,
        cropPath: 'events/e1/photos/p1/crops/colors/helmet/0.jpg',
      })
      expect(color.cropPath).toBe('events/e1/photos/p1/crops/colors/helmet/0.jpg')
    })

    it('fromPersistence round-trips cropPath', () => {
      const color = PhotoColor.fromPersistence({
        id: 'c1',
        photoId: 'p1',
        photoProcessingId: 'pp1',
        source: AttributeSource.ai,
        region: ColorRegion.helmet,
        primaryColor: 'rojo',
        secondaryColor: null,
        confidence: 0.9,
        bboxSource: [0.1, 0.1, 0.2, 0.2],
        strategy: 'gemini-2.5-flash',
        processingMs: 1700,
        createdById: null,
        cropPath: 'events/e1/photos/p1/crops/colors/helmet/0.jpg',
      })
      expect(color.cropPath).toBe('events/e1/photos/p1/crops/colors/helmet/0.jpg')
    })
  })
})
