import { AttributeSource, ProcessingStageName } from '@generated/prisma/client'
import type { ClassificationPipelineResponse } from '@shared/ai-pipeline/domain/ports'
import { PipelineResponseMapper } from './pipeline-response.mapper'

const sampleResponse: ClassificationPipelineResponse = {
  schemaVersion: '1.0',
  imageId: 'photo-1',
  detections: [
    { className: 'helmet', classId: 3, confidence: 0.92, bbox: [0.4, 0.05, 0.58, 0.22] },
  ],
  bibReadings: [
    {
      digits: '20',
      confidence: 0.98,
      confidencePerDigit: [0.99, 0.97],
      status: 'matched',
      rejectionReason: null,
      preprocessingApplied: [],
      bboxSource: [0.1, 0.3, 0.3, 0.55],
      rawOcrText: '20',
      processingMs: 287,
    },
  ],
  colorAnalyses: [
    {
      region: 'helmet',
      primaryColor: 'rojo',
      secondaryColor: 'blanco',
      confidence: 0.9,
      bboxSource: [0.4, 0.05, 0.58, 0.22],
      strategy: 'gemini-2.5-flash',
      processingMs: 1733,
    },
  ],
  imageWidth: 1920,
  imageHeight: 1080,
  processingMs: 5722,
  timings: { totalMs: 5722, detectionMs: 59, ocrMs: 287, colorMs: 5350 },
  stageResults: [
    {
      stage: 'detection',
      status: 'ok',
      itemsProcessed: 1,
      itemsSucceeded: 1,
      itemsFailed: 0,
      notes: [],
    },
    { stage: 'ocr', status: 'ok', itemsProcessed: 1, itemsSucceeded: 1, itemsFailed: 0, notes: [] },
    {
      stage: 'color',
      status: 'ok',
      itemsProcessed: 1,
      itemsSucceeded: 1,
      itemsFailed: 0,
      notes: [],
    },
  ],
  modelVersions: { detection: 'yolo', ocr: 'parseq', color: 'gemini' },
}

describe('PipelineResponseMapper', () => {
  it('maps response to PersistResultInput preserving photoId and timings', () => {
    const startedAt = new Date('2026-05-06T10:00:00Z')
    const completedAt = new Date('2026-05-06T10:00:06Z')
    const input = PipelineResponseMapper.toPersistInput(
      'photo-1',
      sampleResponse,
      startedAt,
      completedAt,
    )

    expect(input.photoId).toBe('photo-1')
    expect(input.processing.schemaVersion).toBe('1.0')
    expect(input.processing.totalMs).toBe(5722)
    expect(input.processing.modelVersions).toEqual({
      detection: 'yolo',
      ocr: 'parseq',
      color: 'gemini',
    })
    expect(input.processing.startedAt).toBe(startedAt)
    expect(input.processing.completedAt).toBe(completedAt)
  })

  it('maps each stage with the correct ms from timings', () => {
    const input = PipelineResponseMapper.toPersistInput(
      'photo-1',
      sampleResponse,
      new Date(),
      new Date(),
    )
    const detection = input.stages.find((s) => s.stage === ProcessingStageName.detection)
    const ocr = input.stages.find((s) => s.stage === ProcessingStageName.ocr)
    const color = input.stages.find((s) => s.stage === ProcessingStageName.color)
    expect(detection?.ms).toBe(59)
    expect(ocr?.ms).toBe(287)
    expect(color?.ms).toBe(5350)
  })

  it('maps bibs with source=ai and preserves processingMs per item', () => {
    const input = PipelineResponseMapper.toPersistInput(
      'photo-1',
      sampleResponse,
      new Date(),
      new Date(),
    )
    expect(input.bibs[0].source).toBe(AttributeSource.ai)
    expect(input.bibs[0].processingMs).toBe(287)
    expect(input.bibs[0].digits).toBe('20')
  })

  it('maps colors with source=ai', () => {
    const input = PipelineResponseMapper.toPersistInput(
      'photo-1',
      sampleResponse,
      new Date(),
      new Date(),
    )
    expect(input.colors[0].source).toBe(AttributeSource.ai)
    expect(input.colors[0].region).toBe('helmet')
    expect(input.colors[0].primaryColor).toBe('rojo')
  })

  it('handles empty arrays', () => {
    const empty: ClassificationPipelineResponse = {
      ...sampleResponse,
      detections: [],
      bibReadings: [],
      colorAnalyses: [],
      stageResults: [
        {
          stage: 'detection',
          status: 'ok',
          itemsProcessed: 0,
          itemsSucceeded: 0,
          itemsFailed: 0,
          notes: [],
        },
        {
          stage: 'ocr',
          status: 'skipped',
          itemsProcessed: 0,
          itemsSucceeded: 0,
          itemsFailed: 0,
          notes: ['no_competidor_number_detected'],
        },
        {
          stage: 'color',
          status: 'skipped',
          itemsProcessed: 0,
          itemsSucceeded: 0,
          itemsFailed: 0,
          notes: ['no_color_regions_detected'],
        },
      ],
    }
    const input = PipelineResponseMapper.toPersistInput('photo-1', empty, new Date(), new Date())
    expect(input.detections).toEqual([])
    expect(input.bibs).toEqual([])
    expect(input.colors).toEqual([])
    expect(input.stages.find((s) => s.stage === 'ocr')?.status).toBe('skipped')
  })
})
