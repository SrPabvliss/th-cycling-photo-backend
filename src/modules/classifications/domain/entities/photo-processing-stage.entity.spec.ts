import { ProcessingStageName, ProcessingStageStatus } from '@generated/prisma/client'
import { PhotoProcessingStage } from './photo-processing-stage.entity'

describe('PhotoProcessingStage', () => {
  it('builds with all fields and honors enum values', () => {
    const stage = PhotoProcessingStage.create({
      photoProcessingId: 'pp-1',
      stage: ProcessingStageName.detection,
      status: ProcessingStageStatus.ok,
      ms: 1234,
      itemsProcessed: 5,
      itemsSucceeded: 4,
      itemsFailed: 1,
      notes: ['retried once'],
    })
    expect(stage.id).toEqual(expect.any(String))
    expect(stage.id.length).toBeGreaterThan(0)
    expect(stage.photoProcessingId).toBe('pp-1')
    expect(stage.stage).toBe(ProcessingStageName.detection)
    expect(stage.status).toBe(ProcessingStageStatus.ok)
    expect(stage.ms).toBe(1234)
    expect(stage.itemsProcessed).toBe(5)
    expect(stage.itemsSucceeded).toBe(4)
    expect(stage.itemsFailed).toBe(1)
    expect(stage.notes).toEqual(['retried once'])
  })
})
