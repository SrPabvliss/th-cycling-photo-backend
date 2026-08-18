import type { IOrderReadRepository } from '@orders/domain/ports'
import { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository, IPhotoWriteRepository } from '@photos/domain/ports'
import { PhotoStatus } from '@photos/domain/value-objects/photo-status.vo'
import type { IPreviewLinkReadRepository } from '@previews/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import type { IKvStorageAdapter } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports'
import { DeletePhotoCommand } from './delete-photo.command'
import { DeletePhotoHandler } from './delete-photo.handler'

describe('DeletePhotoHandler', () => {
  let handler: DeletePhotoHandler
  let photoRead: jest.Mocked<IPhotoReadRepository>
  let photoWrite: jest.Mocked<IPhotoWriteRepository>
  let storage: jest.Mocked<IStorageAdapter>
  let kv: jest.Mocked<IKvStorageAdapter>
  let orderRead: jest.Mocked<IOrderReadRepository>
  let previewRead: jest.Mocked<IPreviewLinkReadRepository>
  let authz: jest.Mocked<IAuthorizationService>
  const unrestrictedScope = EventScope.unrestricted()

  const command = new DeletePhotoCommand('photo-001', 'user-001')

  const makePhoto = (overrides: Partial<Parameters<typeof Photo.fromPersistence>[0]> = {}): Photo =>
    Photo.fromPersistence({
      id: 'photo-001',
      eventId: 'event-001',
      filename: 'photo-001.jpg',
      storageKey: 'events/e1/original/photo-001.jpg',
      publicSlug: 'slug-abc',
      fileSize: BigInt(1024),
      mimeType: 'image/jpeg',
      width: 800,
      height: 600,
      status: PhotoStatus.PROCESSED,
      capturedAt: null,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
      processedAt: null,
      reviewedAt: null,
      retouchedStorageKey: null,
      retouchedPublicSlug: null,
      retouchedFileSize: null,
      retouchedAt: null,
      ...overrides,
    })

  beforeEach(() => {
    photoRead = {
      findById: jest.fn(),
      findByIdInScope: jest.fn(),
    } as unknown as jest.Mocked<IPhotoReadRepository>
    photoWrite = {
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IPhotoWriteRepository>
    storage = {
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IStorageAdapter>
    kv = {
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IKvStorageAdapter>
    orderRead = {
      existsByPhotoId: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<IOrderReadRepository>
    previewRead = {
      existsByPhotoId: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<IPreviewLinkReadRepository>
    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as jest.Mocked<IAuthorizationService>

    handler = new DeletePhotoHandler(
      photoRead,
      photoWrite,
      storage,
      kv,
      orderRead,
      previewRead,
      authz,
    )
  })

  it('throws NOT_FOUND when the photo does not exist', async () => {
    photoRead.findByIdInScope.mockResolvedValueOnce(null)
    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(photoWrite.delete).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the photo exists but its event is outside the caller scope', async () => {
    // This is the coordinator-flagged case: a photo the caller's template
    // permits `photo.delete` on in general, but whose event belongs to
    // another tenant. The scoped load must be what denies it — findByIdInScope
    // is the one deciding, and it returns null exactly as it would for an
    // unknown id, so the caller cannot distinguish "not mine" from
    // "does not exist" (no enumeration of other tenants' photo ids).
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    photoRead.findByIdInScope.mockResolvedValueOnce(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(photoRead.findByIdInScope).toHaveBeenCalledWith('photo-001', restrictedScope)
    expect(authz.assert).not.toHaveBeenCalled()
    expect(photoWrite.delete).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('rejects when the caller holds photo.delete in general but is denied on this event', async () => {
    photoRead.findByIdInScope.mockResolvedValueOnce(makePhoto())
    authz.assert.mockRejectedValueOnce(new Error('Insufficient permissions'))

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(photoWrite.delete).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('throws BUSINESS_RULE and does not delete when the photo is in an order', async () => {
    photoRead.findByIdInScope.mockResolvedValueOnce(makePhoto())
    orderRead.existsByPhotoId.mockResolvedValueOnce(true)
    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('BUSINESS_RULE')
    expect(photoWrite.delete).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('throws BUSINESS_RULE and does not delete when the photo is in a preview link', async () => {
    photoRead.findByIdInScope.mockResolvedValueOnce(makePhoto())
    previewRead.existsByPhotoId.mockResolvedValueOnce(true)
    const error = await handler.execute(command).catch((e) => e)
    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('BUSINESS_RULE')
    expect(photoWrite.delete).not.toHaveBeenCalled()
  })

  it('deletes the row then the original object and slug (no retouched version)', async () => {
    photoRead.findByIdInScope.mockResolvedValueOnce(makePhoto())
    await handler.execute(command)
    expect(authz.assert).toHaveBeenCalledWith('user-001', 'photo.delete', 'event-001')
    expect(photoWrite.delete).toHaveBeenCalledWith('photo-001')
    expect(storage.delete).toHaveBeenCalledWith('events/e1/original/photo-001.jpg')
    expect(storage.delete).toHaveBeenCalledTimes(1)
    expect(kv.delete).toHaveBeenCalledWith('slug-abc')
    expect(kv.delete).toHaveBeenCalledTimes(1)
  })

  it('also deletes the retouched object and slug when present', async () => {
    photoRead.findByIdInScope.mockResolvedValueOnce(
      makePhoto({
        retouchedStorageKey: 'events/e1/retouched/photo-001.jpg',
        retouchedPublicSlug: 'slug-ret',
      }),
    )
    await handler.execute(command)
    expect(storage.delete).toHaveBeenCalledWith('events/e1/retouched/photo-001.jpg')
    expect(storage.delete).toHaveBeenCalledTimes(2)
    expect(kv.delete).toHaveBeenCalledWith('slug-ret')
    expect(kv.delete).toHaveBeenCalledTimes(2)
  })

  it('still succeeds when bucket/KV cleanup fails (best-effort)', async () => {
    photoRead.findByIdInScope.mockResolvedValueOnce(makePhoto())
    storage.delete.mockRejectedValueOnce(new Error('B2 down'))
    kv.delete.mockRejectedValueOnce(new Error('KV down'))
    await expect(handler.execute(command)).resolves.toBeUndefined()
    expect(photoWrite.delete).toHaveBeenCalledWith('photo-001')
  })
})
