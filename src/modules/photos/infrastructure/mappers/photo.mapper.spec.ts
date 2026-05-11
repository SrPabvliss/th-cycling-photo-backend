import {
  AttributeSource,
  BibReadingStatus,
  ColorRegion,
  CorrectionTargetType,
  Prisma,
} from '@generated/prisma/client'
import type { ICorrectionRepository, ILatestCorrection } from '@photos/domain/ports'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'
import { type PhotoDetailSelect, toDetailProjection } from './photo.mapper'

const buildRecord = (overrides: Partial<PhotoDetailSelect> = {}): PhotoDetailSelect =>
  ({
    id: 'photo-1',
    event_id: 'event-1',
    event: { slug: 'evt-slug' },
    filename: 'IMG.jpg',
    public_slug: 'pub-slug',
    file_size: BigInt(1234),
    mime_type: 'image/jpeg',
    width: 1920,
    height: 1080,
    status: 'processed',
    retouched_public_slug: null,
    retouched_file_size: null,
    retouched_at: null,
    captured_at: null,
    uploaded_at: new Date('2026-05-01T00:00:00Z'),
    processed_at: new Date('2026-05-01T00:01:00Z'),
    reviewed_at: null,
    bibs: [],
    colors: [],
    ...overrides,
  }) as unknown as PhotoDetailSelect

const cdn = {
  internalUrl: (slug: string, _kind: string) => `https://cdn.example.com/${slug}`,
} as unknown as CdnUrlBuilder

const buildStorage = (): jest.Mocked<IStorageAdapter> => ({
  upload: jest.fn(),
  getPresignedUrl: jest.fn(),
  getPresignedDownloadUrl: jest.fn(async ({ key }) => `https://signed/${key}?sig=x`),
  getPublicUrl: jest.fn(),
  delete: jest.fn(),
})

const buildCorrectionRepo = (
  map: Map<string, ILatestCorrection> = new Map(),
): jest.Mocked<ICorrectionRepository> => ({
  appendCorrection: jest.fn(),
  findLatestByTargets: jest.fn(async (_targets) => map),
  findLatestForTarget: jest.fn(),
})

describe('toDetailProjection', () => {
  it('returns empty bibs/colors when relations are empty', async () => {
    const storage = buildStorage()
    const result = await toDetailProjection(buildRecord(), cdn, storage, buildCorrectionRepo())
    expect(result.bibs).toEqual([])
    expect(result.colors).toEqual([])
    expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled()
  })

  it('signs cropUrl for each bib with crop_path', async () => {
    const storage = buildStorage()
    const record = buildRecord({
      bibs: [
        {
          id: 'b1',
          source: AttributeSource.ai,
          digits: '20',
          status: BibReadingStatus.read,
          confidence: new Prisma.Decimal(0.95),
          crop_path: 'events/e/photos/p/crops/bibs/0.jpg',
        },
      ] as unknown as PhotoDetailSelect['bibs'],
    })
    const result = await toDetailProjection(record, cdn, storage, buildCorrectionRepo())
    expect(result.bibs[0].cropUrl).toContain('events/e/photos/p/crops/bibs/0.jpg')
    expect(result.bibs[0].cropUrl).toContain('sig=x')
    expect(result.bibs[0].confidence).toBe(0.95)
  })

  it('returns null cropUrl when bib has null crop_path', async () => {
    const storage = buildStorage()
    const record = buildRecord({
      bibs: [
        {
          id: 'b1',
          source: AttributeSource.ai,
          digits: '20',
          status: BibReadingStatus.read,
          confidence: null,
          crop_path: null,
        },
      ] as unknown as PhotoDetailSelect['bibs'],
    })
    const result = await toDetailProjection(record, cdn, storage, buildCorrectionRepo())
    expect(result.bibs[0].cropUrl).toBeNull()
    expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled()
  })

  it('returns null cropUrl when signing rejects, others still resolve', async () => {
    const storage = buildStorage()
    storage.getPresignedDownloadUrl.mockImplementation(async ({ key }) => {
      if (key === 'fails/0.jpg') throw new Error('boom')
      return `https://signed/${key}?sig=x`
    })
    const record = buildRecord({
      bibs: [
        {
          id: 'b1',
          source: AttributeSource.ai,
          digits: '20',
          status: null,
          confidence: null,
          crop_path: 'fails/0.jpg',
        },
        {
          id: 'b2',
          source: AttributeSource.ai,
          digits: '47',
          status: null,
          confidence: null,
          crop_path: 'ok/0.jpg',
        },
      ] as unknown as PhotoDetailSelect['bibs'],
    })
    const result = await toDetailProjection(record, cdn, storage, buildCorrectionRepo())
    expect(result.bibs[0].cropUrl).toBeNull()
    expect(result.bibs[1].cropUrl).toContain('ok/0.jpg')
  })

  it('signs cropUrl for color attributes analogously', async () => {
    const storage = buildStorage()
    const record = buildRecord({
      colors: [
        {
          id: 'c1',
          source: AttributeSource.ai,
          region: ColorRegion.helmet,
          primary_color: 'rojo',
          secondary_color: null,
          confidence: new Prisma.Decimal(0.9),
          crop_path: 'events/e/photos/p/crops/colors/helmet/0.jpg',
        },
      ] as unknown as PhotoDetailSelect['colors'],
    })
    const result = await toDetailProjection(record, cdn, storage, buildCorrectionRepo())
    expect(result.colors[0].cropUrl).toContain('crops/colors/helmet/0.jpg')
    expect(result.colors[0].region).toBe(ColorRegion.helmet)
    expect(result.colors[0].confidence).toBe(0.9)
  })

  it('deduplicates signing for repeated crop_paths across bibs and colors', async () => {
    const storage = buildStorage()
    const dupPath = 'events/e/photos/p/crops/bibs/0.jpg'
    const record = buildRecord({
      bibs: [
        {
          id: 'b1',
          source: AttributeSource.ai,
          digits: '20',
          status: null,
          confidence: null,
          crop_path: dupPath,
        },
      ] as unknown as PhotoDetailSelect['bibs'],
      colors: [
        {
          id: 'c1',
          source: AttributeSource.ai,
          region: ColorRegion.helmet,
          primary_color: 'rojo',
          secondary_color: null,
          confidence: null,
          crop_path: dupPath,
        },
      ] as unknown as PhotoDetailSelect['colors'],
    })
    await toDetailProjection(record, cdn, storage, buildCorrectionRepo())
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledTimes(1)
  })

  describe('with corrections', () => {
    it('applies bib digits correction when present', async () => {
      const storage = buildStorage()
      const correctedAt = new Date('2026-05-02T10:00:00Z')
      const corrections = new Map<string, ILatestCorrection>([
        [
          'photo_bib:b1:digits',
          {
            id: 'corr-1',
            newValue: '99',
            oldValue: '20',
            correctedAt,
            reviewerId: 'rev-1',
          },
        ],
      ])
      const record = buildRecord({
        bibs: [
          {
            id: 'b1',
            source: AttributeSource.ai,
            digits: '20',
            status: BibReadingStatus.read,
            confidence: new Prisma.Decimal(0.95),
            crop_path: null,
          },
        ] as unknown as PhotoDetailSelect['bibs'],
      })
      const repo = buildCorrectionRepo(corrections)
      const result = await toDetailProjection(record, cdn, storage, repo)

      expect(repo.findLatestByTargets).toHaveBeenCalledWith([
        { targetType: CorrectionTargetType.photo_bib, targetId: 'b1' },
      ])
      expect(result.bibs[0].digits).toBe('99')
      expect(result.bibs[0].digitsOriginal).toBe('20')
      expect(result.bibs[0].wasCorrected).toBe(true)
      expect(result.bibs[0].correctedAt).toBe(correctedAt)
    })

    it('returns original bib digits with wasCorrected=false when no correction', async () => {
      const storage = buildStorage()
      const record = buildRecord({
        bibs: [
          {
            id: 'b1',
            source: AttributeSource.ai,
            digits: '20',
            status: BibReadingStatus.read,
            confidence: null,
            crop_path: null,
          },
        ] as unknown as PhotoDetailSelect['bibs'],
      })
      const result = await toDetailProjection(record, cdn, storage, buildCorrectionRepo())
      expect(result.bibs[0].digits).toBe('20')
      expect(result.bibs[0].digitsOriginal).toBe('20')
      expect(result.bibs[0].wasCorrected).toBe(false)
      expect(result.bibs[0].correctedAt).toBeNull()
    })

    it('applies primary color correction without affecting secondary', async () => {
      const storage = buildStorage()
      const correctedAt = new Date('2026-05-02T11:00:00Z')
      const corrections = new Map<string, ILatestCorrection>([
        [
          'photo_color:c1:primary_color',
          {
            id: 'corr-2',
            newValue: 'azul',
            oldValue: 'rojo',
            correctedAt,
            reviewerId: 'rev-1',
          },
        ],
      ])
      const record = buildRecord({
        colors: [
          {
            id: 'c1',
            source: AttributeSource.ai,
            region: ColorRegion.helmet,
            primary_color: 'rojo',
            secondary_color: 'verde',
            confidence: null,
            crop_path: null,
          },
        ] as unknown as PhotoDetailSelect['colors'],
      })
      const result = await toDetailProjection(
        record,
        cdn,
        storage,
        buildCorrectionRepo(corrections),
      )
      expect(result.colors[0].primaryColor).toBe('azul')
      expect(result.colors[0].primaryColorOriginal).toBe('rojo')
      expect(result.colors[0].primaryWasCorrected).toBe(true)
      expect(result.colors[0].secondaryColor).toBe('verde')
      expect(result.colors[0].secondaryColorOriginal).toBe('verde')
      expect(result.colors[0].secondaryWasCorrected).toBe(false)
    })
  })
})
