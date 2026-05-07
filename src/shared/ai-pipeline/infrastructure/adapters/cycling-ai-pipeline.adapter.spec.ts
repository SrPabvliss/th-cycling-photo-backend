import { ConfigService } from '@nestjs/config'
import { AppException, ErrorCode } from '@shared/domain'
import invalidSchema from '../../../../../test/fixtures/ai-pipeline/invalid-schema-version.json'
import noDetections from '../../../../../test/fixtures/ai-pipeline/no-detections.json'
import singleCyclist from '../../../../../test/fixtures/ai-pipeline/single-cyclist.json'
import { CyclingAiPipelineAdapter } from './cycling-ai-pipeline.adapter'

const fetchMock = jest.fn()
;(global as any).fetch = fetchMock

const buildResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  }) as unknown as Response

const baseConfig: Partial<ConfigService> = {
  getOrThrow: jest.fn().mockReturnValue('http://ai-service:8000'),
  get: jest.fn().mockReturnValue(15_000),
}

describe('CyclingAiPipelineAdapter', () => {
  let adapter: CyclingAiPipelineAdapter

  beforeEach(() => {
    fetchMock.mockReset()
    adapter = new CyclingAiPipelineAdapter(baseConfig as ConfigService)
  })

  it('parses a v1.0 happy-path response', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(singleCyclist))
    const r = await adapter.classify({
      imageId: '00000000-0000-0000-0000-000000000001',
      imageUrl: 'https://x/y.jpg',
    })
    expect(r.schemaVersion).toBe('1.0')
    expect(r.imageId).toBe('00000000-0000-0000-0000-000000000001')
    expect(r.detections).toHaveLength(2)
    expect(r.bibReadings[0].processingMs).toBe(287.0)
    expect(r.colorAnalyses[0].region).toBe('helmet')
    expect(r.timings.totalMs).toBe(5722.0)
    expect(r.stageResults).toHaveLength(3)
    expect(r.modelVersions.color).toBe('gemini')
  })

  it('handles empty arrays (no detections fixture)', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(noDetections))
    const r = await adapter.classify({
      imageId: '00000000-0000-0000-0000-000000000002',
      imageUrl: 'https://x/y.jpg',
    })
    expect(r.detections).toHaveLength(0)
    expect(r.bibReadings).toHaveLength(0)
    expect(r.colorAnalyses).toHaveLength(0)
    expect(r.stageResults.find((s) => s.stage === 'ocr')?.status).toBe('skipped')
  })

  it('throws unsupported_schema_version when schema_version != 1.0', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(invalidSchema))
    await expect(
      adapter.classify({
        imageId: invalidSchema.image_id,
        imageUrl: 'https://x/y.jpg',
      }),
    ).rejects.toMatchObject({ messageKey: 'ai_pipeline.unsupported_schema_version' })
  })

  it('throws image_id_mismatch when echo differs', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(singleCyclist))
    await expect(
      adapter.classify({
        imageId: 'different-uuid',
        imageUrl: 'https://x/y.jpg',
      }),
    ).rejects.toMatchObject({ messageKey: 'ai_pipeline.image_id_mismatch' })
  })

  it('throws invalid_response_shape on Zod failure (missing timings)', async () => {
    const broken = { ...singleCyclist, timings: undefined }
    fetchMock.mockResolvedValueOnce(buildResponse(broken))
    await expect(
      adapter.classify({
        imageId: singleCyclist.image_id,
        imageUrl: 'https://x/y.jpg',
      }),
    ).rejects.toMatchObject({ messageKey: 'ai_pipeline.invalid_response_shape' })
  })

  it('throws service_unavailable on 5xx', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse({ error: 'down' }, false, 503))
    await expect(
      adapter.classify({
        imageId: singleCyclist.image_id,
        imageUrl: 'https://x/y.jpg',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.EXTERNAL_SERVICE,
      messageKey: 'ai_pipeline.service_unavailable',
    } as Partial<AppException>)
  })

  it('throws invalid_request on 4xx', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse({ error: 'bad input' }, false, 400))
    await expect(
      adapter.classify({
        imageId: singleCyclist.image_id,
        imageUrl: 'https://x/y.jpg',
      }),
    ).rejects.toMatchObject({ messageKey: 'ai_pipeline.invalid_request' })
  })

  it('sends image_id in request body', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(singleCyclist))
    await adapter.classify({
      imageId: singleCyclist.image_id,
      imageUrl: 'https://x/y.jpg',
      eventId: 'evt-1',
      confidenceThreshold: 0.3,
    })
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.image_id).toBe(singleCyclist.image_id)
    expect(body.image_url).toBe('https://x/y.jpg')
    expect(body.event_id).toBe('evt-1')
    expect(body.confidence_threshold).toBe(0.3)
    expect(body).not.toHaveProperty('startlist')
  })
})
