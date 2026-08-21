import type { FreezeStateService } from '@events/application/services/freeze-state.service'
import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports'
import { GenerateAssetPresignedUrlCommand } from './generate-asset-presigned-url.command'
import { GenerateAssetPresignedUrlHandler } from './generate-asset-presigned-url.handler'

describe('GenerateAssetPresignedUrlHandler', () => {
  let handler: GenerateAssetPresignedUrlHandler
  let eventReadRepo: jest.Mocked<IEventReadRepository>
  let storage: jest.Mocked<IStorageAdapter>
  let authz: jest.Mocked<IAuthorizationService>
  const unrestrictedScope = EventScope.unrestricted()

  beforeEach(() => {
    eventReadRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn(),
    } as unknown as jest.Mocked<IEventReadRepository>

    storage = {
      getPresignedUrl: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IStorageAdapter>

    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as jest.Mocked<IAuthorizationService>

    const freeze = {
      assertNotFrozen: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FreezeStateService>

    handler = new GenerateAssetPresignedUrlHandler(eventReadRepo, storage, authz, freeze)
  })

  it('rejects asset types other than cover_image', async () => {
    const command = new GenerateAssetPresignedUrlCommand(
      'event-uuid',
      // biome-ignore lint/suspicious/noExplicitAny: Force-cast forbidden enum to test runtime guard
      'event_logo' as any,
      'logo.jpg',
      'image/jpeg',
      'user-1',
    )

    await expect(handler.execute(command)).rejects.toThrow(/event_asset\.unsupported_type/)
    expect(eventReadRepo.findByIdInScope).not.toHaveBeenCalled()
    expect(storage.getPresignedUrl).not.toHaveBeenCalled()
  })

  it('throws not_found when event does not exist for cover_image', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValue(null)
    const command = new GenerateAssetPresignedUrlCommand(
      'event-uuid',
      'cover_image',
      'banner.jpg',
      'image/jpeg',
      'user-1',
    )

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    eventReadRepo.findByIdInScope.mockResolvedValue(null)
    const command = new GenerateAssetPresignedUrlCommand(
      'other-tenant-event',
      'cover_image',
      'banner.jpg',
      'image/jpeg',
      'user-1',
    )

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(eventReadRepo.findByIdInScope).toHaveBeenCalledWith(
      'other-tenant-event',
      restrictedScope,
    )
    expect(authz.assert).not.toHaveBeenCalled()
    expect(storage.getPresignedUrl).not.toHaveBeenCalled()
  })

  it('generates a presigned URL once the event is verified in scope', async () => {
    const event = Event.fromPersistence({
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
    eventReadRepo.findByIdInScope.mockResolvedValue(event)
    storage.getPresignedUrl.mockResolvedValue({
      url: 'https://example.com/upload',
      objectKey: 'events/event-uuid/assets/cover_image/abc-banner.jpg',
      expiresIn: 300,
    })
    const command = new GenerateAssetPresignedUrlCommand(
      'event-uuid',
      'cover_image',
      'banner.jpg',
      'image/jpeg',
      'user-1',
    )

    const result = await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith('user-1', 'event_asset.presign', 'event-uuid')
    expect(result.url).toBe('https://example.com/upload')
  })
})
