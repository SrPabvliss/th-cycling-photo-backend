import { PHOTO_CLASSIFICATION_WRITE_REPOSITORY } from '@classifications/domain/ports'
import { Test } from '@nestjs/testing'
import { PHOTO_READ_REPOSITORY, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import { CLASSIFICATION_PIPELINE_ADAPTER } from '@shared/ai-pipeline'
import { AppException } from '@shared/domain'
import { STORAGE_ADAPTER } from '@shared/storage/domain/ports/storage-adapter.port'
import { ProcessPhotoClassificationCommand } from './process-photo-classification.command'
import { ProcessPhotoClassificationHandler } from './process-photo-classification.handler'

const okPhoto = (overrides: any = {}) => ({
  id: 'photo-1',
  storageKey: 'k',
  eventId: 'evt-1',
  status: 'pending',
  markProcessing: jest.fn(),
  markProcessed: jest.fn(),
  markFailed: jest.fn(),
  ...overrides,
})

const baseResponse = {
  schemaVersion: '1.0',
  imageId: 'photo-1',
  detections: [],
  bibReadings: [],
  colorAnalyses: [],
  imageWidth: 1920,
  imageHeight: 1080,
  processingMs: 1200,
  timings: { totalMs: 1200, detectionMs: 800, ocrMs: 0, colorMs: 0 },
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
  modelVersions: { detection: 'yolo', ocr: 'parseq', color: 'gemini' },
}

describe('ProcessPhotoClassificationHandler', () => {
  let handler: ProcessPhotoClassificationHandler
  const photoReadRepo = { findById: jest.fn() }
  const photoWriteRepo = { save: jest.fn().mockResolvedValue(undefined) }
  const storage = { getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://b2/url.jpg') }
  const adapter = { classify: jest.fn() }
  const writeRepo = {
    persistResult: jest.fn().mockResolvedValue({ processingId: 'p-1' }),
    persistFailure: jest.fn().mockResolvedValue({ processingId: 'p-fail' }),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    photoWriteRepo.save.mockResolvedValue(undefined)
    storage.getPresignedDownloadUrl.mockResolvedValue('https://b2/url.jpg')
    writeRepo.persistResult.mockResolvedValue({ processingId: 'p-1' })
    writeRepo.persistFailure.mockResolvedValue({ processingId: 'p-fail' })
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProcessPhotoClassificationHandler,
        { provide: PHOTO_READ_REPOSITORY, useValue: photoReadRepo },
        { provide: PHOTO_WRITE_REPOSITORY, useValue: photoWriteRepo },
        { provide: STORAGE_ADAPTER, useValue: storage },
        { provide: CLASSIFICATION_PIPELINE_ADAPTER, useValue: adapter },
        { provide: PHOTO_CLASSIFICATION_WRITE_REPOSITORY, useValue: writeRepo },
      ],
    }).compile()
    handler = moduleRef.get(ProcessPhotoClassificationHandler)
  })

  it('happy path: marks processing → calls adapter → persists → marks processed', async () => {
    const photo = okPhoto()
    photoReadRepo.findById.mockResolvedValue(photo)
    adapter.classify.mockResolvedValue(baseResponse)

    await handler.execute(new ProcessPhotoClassificationCommand('photo-1'))

    expect(photoReadRepo.findById).toHaveBeenCalledWith('photo-1')
    expect(photo.markProcessing).toHaveBeenCalled()
    expect(adapter.classify).toHaveBeenCalledWith(expect.objectContaining({ imageId: 'photo-1' }))
    expect(writeRepo.persistResult).toHaveBeenCalled()
    expect(photo.markProcessed).toHaveBeenCalledWith(1920, 1080)
    expect(photoWriteRepo.save).toHaveBeenCalledTimes(2)
  })

  it('throws notFound when photo missing', async () => {
    photoReadRepo.findById.mockResolvedValue(null)
    await expect(
      handler.execute(new ProcessPhotoClassificationCommand('missing')),
    ).rejects.toBeInstanceOf(AppException)
    expect(adapter.classify).not.toHaveBeenCalled()
  })

  it('rejects when status is processed', async () => {
    photoReadRepo.findById.mockResolvedValue(okPhoto({ status: 'processed' }))
    await expect(
      handler.execute(new ProcessPhotoClassificationCommand('photo-1')),
    ).rejects.toMatchObject({ messageKey: 'photo.invalid_status_for_processing' })
  })

  it('rejects when status is reviewed', async () => {
    photoReadRepo.findById.mockResolvedValue(okPhoto({ status: 'reviewed' }))
    await expect(
      handler.execute(new ProcessPhotoClassificationCommand('photo-1')),
    ).rejects.toMatchObject({ messageKey: 'photo.invalid_status_for_processing' })
  })

  it('on schema_version error: persistFailure + markFailed + rethrow', async () => {
    const photo = okPhoto()
    photoReadRepo.findById.mockResolvedValue(photo)
    adapter.classify.mockRejectedValue(
      new AppException(
        'ai_pipeline.unsupported_schema_version' as any,
        502 as any,
        'EXTERNAL_SERVICE' as any,
      ),
    )
    await expect(
      handler.execute(new ProcessPhotoClassificationCommand('photo-1')),
    ).rejects.toMatchObject({ messageKey: 'ai_pipeline.unsupported_schema_version' })
    expect(writeRepo.persistFailure).toHaveBeenCalled()
    expect(photo.markFailed).toHaveBeenCalled()
  })

  it('on service_unavailable: rethrows without persistFailure', async () => {
    const photo = okPhoto()
    photoReadRepo.findById.mockResolvedValue(photo)
    adapter.classify.mockRejectedValue(
      new AppException(
        'ai_pipeline.service_unavailable' as any,
        502 as any,
        'EXTERNAL_SERVICE' as any,
      ),
    )
    await expect(
      handler.execute(new ProcessPhotoClassificationCommand('photo-1')),
    ).rejects.toMatchObject({ messageKey: 'ai_pipeline.service_unavailable' })
    expect(writeRepo.persistFailure).not.toHaveBeenCalled()
    expect(photo.markFailed).not.toHaveBeenCalled()
  })
})
