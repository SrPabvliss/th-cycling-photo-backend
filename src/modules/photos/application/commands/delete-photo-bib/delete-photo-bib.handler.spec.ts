import { Photo } from '@photos/domain/entities'
import { AppException } from '@shared/domain'
import { DeletePhotoBibCommand } from './delete-photo-bib.command'
import { DeletePhotoBibHandler } from './delete-photo-bib.handler'

const buildPhoto = (status: any = 'processed', reviewedAt: Date | null = null) =>
  Photo.fromPersistence({
    id: 'p-1',
    eventId: 'e-1',
    filename: 'a.jpg',
    storageKey: 'k',
    fileSize: 1n,
    mimeType: 'image/jpeg',
    width: 10,
    height: 10,
    status,
    capturedAt: null,
    uploadedAt: new Date(),
    processedAt: new Date(),
    reviewedAt,
    publicSlug: 's',
    retouchedStorageKey: null,
    retouchedPublicSlug: null,
    retouchedFileSize: null,
    retouchedAt: null,
  })

describe('DeletePhotoBibHandler', () => {
  let handler: DeletePhotoBibHandler
  let photoReadRepo: any
  let bibRepo: any
  let loggerSpy: jest.SpyInstance

  beforeEach(() => {
    photoReadRepo = { findById: jest.fn() }
    bibRepo = { findById: jest.fn(), save: jest.fn(), softDelete: jest.fn() }
    handler = new DeletePhotoBibHandler(photoReadRepo, bibRepo)
    loggerSpy = jest.spyOn((handler as any).logger, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    loggerSpy.mockRestore()
  })

  it('happy path: returns { bibId, photoId }, calls softDelete, emits audit log', async () => {
    photoReadRepo.findById.mockResolvedValue(buildPhoto())
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'p-1', digits: '42' })
    bibRepo.softDelete.mockResolvedValue(undefined)

    const result = await handler.execute(new DeletePhotoBibCommand('p-1', 'b-1', 'r-1'))

    expect(result).toEqual({ bibId: 'b-1', photoId: 'p-1' })
    expect(bibRepo.softDelete).toHaveBeenCalledWith('b-1', 'r-1')
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'photo_attribute_soft_deleted',
        photo_id: 'p-1',
        reviewer_id: 'r-1',
        attribute_type: 'photo_bib',
        attribute_id: 'b-1',
        payload: { digits: '42' },
      }),
    )
  })

  it('throws when photo missing', async () => {
    photoReadRepo.findById.mockResolvedValue(null)
    await expect(
      handler.execute(new DeletePhotoBibCommand('p-x', 'b-1', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(bibRepo.softDelete).not.toHaveBeenCalled()
  })

  it('throws when status=processing', async () => {
    photoReadRepo.findById.mockResolvedValue(buildPhoto('processing'))
    await expect(
      handler.execute(new DeletePhotoBibCommand('p-1', 'b-1', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(bibRepo.softDelete).not.toHaveBeenCalled()
  })

  it('throws when bib not found', async () => {
    photoReadRepo.findById.mockResolvedValue(buildPhoto())
    bibRepo.findById.mockResolvedValue(null)
    await expect(
      handler.execute(new DeletePhotoBibCommand('p-1', 'b-1', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(bibRepo.softDelete).not.toHaveBeenCalled()
  })

  it('throws when bib belongs to another photo', async () => {
    photoReadRepo.findById.mockResolvedValue(buildPhoto())
    bibRepo.findById.mockResolvedValue({ id: 'b-1', photoId: 'OTHER', digits: '42' })
    await expect(
      handler.execute(new DeletePhotoBibCommand('p-1', 'b-1', 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(bibRepo.softDelete).not.toHaveBeenCalled()
  })
})
