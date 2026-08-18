import { BibReadingStatus } from '@generated/prisma/client'
import { Photo } from '@photos/domain/entities'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AppException } from '@shared/domain'
import { AddPhotoBibCommand } from './add-photo-bib.command'
import { AddPhotoBibHandler } from './add-photo-bib.handler'

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

describe('AddPhotoBibHandler', () => {
  let handler: AddPhotoBibHandler
  let photoReadRepo: any
  let bibRepo: any

  let authz: any
  const scope = EventScope.unrestricted()

  beforeEach(() => {
    photoReadRepo = { findById: jest.fn(), findByIdInScope: jest.fn() }
    bibRepo = { findById: jest.fn(), save: jest.fn() }
    authz = {
      resolveEventScope: jest.fn().mockResolvedValue(scope),
      assert: jest.fn().mockResolvedValue(undefined),
    }
    handler = new AddPhotoBibHandler(photoReadRepo, bibRepo, authz)
  })

  it('throws when photo missing (including out-of-scope)', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(null)
    await expect(
      handler.execute(new AddPhotoBibCommand('p-x', '42', undefined, 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('rejects when the caller lacks photo.bib.create for this event', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))
    await expect(
      handler.execute(new AddPhotoBibCommand('p-1', '42', undefined, 'r-1')),
    ).rejects.toThrow('Insufficient permissions')
    expect(bibRepo.save).not.toHaveBeenCalled()
  })

  it('throws when status=processing', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto('processing'))
    await expect(
      handler.execute(new AddPhotoBibCommand('p-1', '42', undefined, 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('throws when digits fail regex', async () => {
    photoReadRepo.findByIdInScope.mockResolvedValue(buildPhoto())
    await expect(
      handler.execute(new AddPhotoBibCommand('p-1', 'abc', undefined, 'r-1')),
    ).rejects.toBeInstanceOf(AppException)
  })

  it('happy path persists manual bib and does NOT auto-mark photo reviewed', async () => {
    const photo = buildPhoto('processed', null)
    const initialStatus = photo.status
    const initialReviewedAt = photo.reviewedAt
    photoReadRepo.findByIdInScope.mockResolvedValue(photo)
    bibRepo.save.mockImplementation((b: any) => Promise.resolve(b))

    const result = await handler.execute(
      new AddPhotoBibCommand('p-1', '42', BibReadingStatus.read, 'r-1'),
    )

    expect(result.photoId).toBe('p-1')
    expect(result.bibId).toBeDefined()
    expect(bibRepo.save).toHaveBeenCalled()
    expect(photo.status).toBe(initialStatus)
    expect(photo.reviewedAt).toBe(initialReviewedAt)
  })
})
