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
  })
})
