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

  it('calls pipeline with color=none (TIT-9: color stage disabled)', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(singleCyclist))
    await adapter.classify({
      imageId: '00000000-0000-0000-0000-000000000001',
      imageUrl: 'https://x/y.jpg',
    })
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('color=none')
    expect(calledUrl).not.toContain('color=gemini')
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

  it('accepts schema_version 1.1', async () => {
    const v11 = { ...singleCyclist, schema_version: '1.1' }
    fetchMock.mockResolvedValueOnce(buildResponse(v11))
    const r = await adapter.classify({
      imageId: singleCyclist.image_id,
      imageUrl: 'https://x/y.jpg',
    })
    expect(r.schemaVersion).toBe('1.1')
  })

  it('sends crop_upload_urls in body when provided', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse({ ...singleCyclist, schema_version: '1.1' }))
    await adapter.classify({
      imageId: singleCyclist.image_id,
      imageUrl: 'https://x/y.jpg',
      cropUploadUrls: {
        bibs: ['u-bib-0'],
        colorsHelmet: ['u-helmet-0'],
        colorsClothes: ['u-clothes-0'],
        colorsBicycle: ['u-bicycle-0'],
      },
    })
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.crop_upload_urls).toEqual({
      bibs: ['u-bib-0'],
      colors_helmet: ['u-helmet-0'],
      colors_clothes: ['u-clothes-0'],
      colors_bicycle: ['u-bicycle-0'],
    })
  })

  it('omits crop_upload_urls from body when not provided', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(singleCyclist))
    await adapter.classify({
      imageId: singleCyclist.image_id,
      imageUrl: 'https://x/y.jpg',
    })
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).not.toHaveProperty('crop_upload_urls')
  })

  it('maps crop_path from bib_readings and color_analyses (v1.1)', async () => {
    const v11WithCrops = {
      ...singleCyclist,
      schema_version: '1.1',
      bib_readings: singleCyclist.bib_readings.map((b: object) => ({
        ...b,
        crop_path: 'events/e/photos/p/crops/bibs/0.jpg',
      })),
      color_analyses: singleCyclist.color_analyses.map((c: object) => ({
        ...c,
        crop_path: 'events/e/photos/p/crops/colors/helmet/0.jpg',
      })),
    }
    fetchMock.mockResolvedValueOnce(buildResponse(v11WithCrops))
    const r = await adapter.classify({
      imageId: singleCyclist.image_id,
      imageUrl: 'https://x/y.jpg',
    })
    expect(r.bibReadings[0].cropPath).toBe('events/e/photos/p/crops/bibs/0.jpg')
    expect(r.colorAnalyses[0].cropPath).toBe('events/e/photos/p/crops/colors/helmet/0.jpg')
  })

  it('maps missing crop_path to null (backwards compat with v1.0)', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(singleCyclist))
    const r = await adapter.classify({
      imageId: singleCyclist.image_id,
      imageUrl: 'https://x/y.jpg',
    })
    expect(r.bibReadings[0].cropPath).toBeNull()
    expect(r.colorAnalyses[0].cropPath).toBeNull()
  })
})
