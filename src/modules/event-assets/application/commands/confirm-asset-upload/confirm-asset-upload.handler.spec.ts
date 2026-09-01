import type { FreezeStateService } from '@events/application/services/freeze-state.service'
import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import type { IKvStorageAdapter } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import type { IStorageAdapter } from '@shared/storage/domain/ports'
import type { IEventAssetReadRepository, IEventAssetWriteRepository } from '../../../domain/ports'
import { ConfirmAssetUploadCommand } from './confirm-asset-upload.command'
import { ConfirmAssetUploadHandler } from './confirm-asset-upload.handler'

describe('ConfirmAssetUploadHandler', () => {
  let handler: ConfirmAssetUploadHandler
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

  beforeEach(() => {
    eventReadRepo = {
      findById: jest.fn(),
      findByIdInScope: jest.fn(),
    } as unknown as jest.Mocked<IEventReadRepository>

    readRepo = {
      findByEventAndType: jest.fn(),
    } as unknown as jest.Mocked<IEventAssetReadRepository>

    writeRepo = {
      save: jest.fn(),
    } as unknown as jest.Mocked<IEventAssetWriteRepository>

    storage = {
      delete: jest.fn(),
    } as unknown as jest.Mocked<IStorageAdapter>

    kvStorage = {
      write: jest.fn().mockResolvedValue(undefined),
      writeBulk: jest.fn().mockResolvedValue(undefined),
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

    handler = new ConfirmAssetUploadHandler(
      eventReadRepo,
      readRepo,
      writeRepo,
      storage,
      kvStorage,
      authz,
      freeze,
    )
  })

  it('rejects asset types other than cover_image', async () => {
    const command = new ConfirmAssetUploadCommand(
      'event-uuid',
      // biome-ignore lint/suspicious/noExplicitAny: Force-cast forbidden enum to test runtime guard
      'poster' as any,
      'events/event-uuid/assets/poster/foo.jpg',
      null,
      null,
      'user-1',
    )

    await expect(handler.execute(command)).rejects.toThrow(/event_asset\.unsupported_type/)
    expect(eventReadRepo.findByIdInScope).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    eventReadRepo.findByIdInScope.mockResolvedValue(null)
    const command = new ConfirmAssetUploadCommand(
      'other-tenant-event',
      'cover_image',
      'events/other-tenant-event/assets/cover_image/foo.jpg',
      null,
      null,
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
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('confirms the upload once the event is verified in scope', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValue(buildEvent())
    readRepo.findByEventAndType.mockResolvedValue(null)
    writeRepo.save.mockImplementation(async (asset) => asset)
    const command = new ConfirmAssetUploadCommand(
      'event-uuid',
      'cover_image',
      'events/event-uuid/assets/cover_image/foo.jpg',
      1024n,
      'image/jpeg',
      'user-1',
    )

    const result = await handler.execute(command)

    expect(authz.assert).toHaveBeenCalledWith('user-1', 'event_asset.confirm', 'event-uuid')
    expect(writeRepo.save).toHaveBeenCalled()
    expect(result.id).toBeDefined()
  })
})
