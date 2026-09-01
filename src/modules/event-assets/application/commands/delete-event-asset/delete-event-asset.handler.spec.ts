import type { FreezeStateService } from '@events/application/services/freeze-state.service'
import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import type { IKvStorageAdapter } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports'
import { EventAsset } from '../../../domain/entities'
import type { IEventAssetReadRepository, IEventAssetWriteRepository } from '../../../domain/ports'
import { DeleteEventAssetCommand } from './delete-event-asset.command'
import { DeleteEventAssetHandler } from './delete-event-asset.handler'

describe('DeleteEventAssetHandler', () => {
  let handler: DeleteEventAssetHandler
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let readRepo: jest.Mocked<IEventAssetReadRepository>
  let writeRepo: jest.Mocked<IEventAssetWriteRepository>
  let storage: jest.Mocked<IStorageAdapter>
  let kvStorage: jest.Mocked<IKvStorageAdapter>
  let authz: jest.Mocked<IAuthorizationService>
  const unrestrictedScope = EventScope.unrestricted()

  const buildEvent = () =>
    Event.fromPersistence({
      id: 'event-uuid',
      tenantId: 'tenant-a',
      name: 'Race',
      slug: 'race',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-02'),
      provinceId: null,
      cantonId: null,
      eventTypeId: 1,
      status: 'active',
      snapPublicName: null,
      snapWatermarkStorageKey: null,
      snapWhatsappNumber: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

  const buildAsset = () =>
    EventAsset.fromPersistence({
      id: 'asset-1',
      eventId: 'event-uuid',
      assetType: 'cover_image',
      storageKey: 'events/event-uuid/assets/cover_image/foo.jpg',
      publicSlug: 'slug-abc',
      fileSize: 1024n,
      mimeType: 'image/jpeg',
      focalX: 0.5,
      focalY: 0.5,
      uploadedAt: new Date(),
    })

  beforeEach(() => {
    eventReadRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn(),
    } as unknown as jest.Mocked<IEventReadRepository>

    readRepo = {
      findByEventAndType: jest.fn(),
    } as unknown as jest.Mocked<IEventAssetReadRepository>

    writeRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IEventAssetWriteRepository>

    storage = {
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IStorageAdapter>

    kvStorage = {
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IKvStorageAdapter>

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as jest.Mocked<IAuthorizationService>

    const freeze = {
      assertNotFrozen: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FreezeStateService>

    handler = new DeleteEventAssetHandler(
      eventReadRepo,
      readRepo,
      writeRepo,
      storage,
      kvStorage,
      authz,
      freeze,
    )
  })

  const command = new DeleteEventAssetCommand('event-uuid', 'cover_image', 'user-1')

  it('throws NOT_FOUND when the event does not exist', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValue(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).not.toHaveBeenCalled()
    expect(readRepo.findByEventAndType).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    eventReadRepo.findByIdInScope.mockResolvedValue(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(eventReadRepo.findByIdInScope).toHaveBeenCalledWith('event-uuid', restrictedScope)
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.delete).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND when the event is in scope but has no asset of this type', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValue(buildEvent())
    readRepo.findByEventAndType.mockResolvedValue(null)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(authz.assert).toHaveBeenCalledWith('user-1', 'event_asset.delete', 'event-uuid')
    expect(writeRepo.delete).not.toHaveBeenCalled()
  })

  it('deletes the asset, storage object, and KV slug once the event is verified in scope', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValue(buildEvent())
    const asset = buildAsset()
    readRepo.findByEventAndType.mockResolvedValue(asset)

    await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith('user-1', 'event_asset.delete', 'event-uuid')
    expect(storage.delete).toHaveBeenCalledWith(asset.storageKey)
    expect(writeRepo.delete).toHaveBeenCalledWith(asset.id)
    expect(kvStorage.delete).toHaveBeenCalledWith(asset.publicSlug)
  })
})
