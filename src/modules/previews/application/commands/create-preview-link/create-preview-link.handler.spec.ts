import { Event } from '@events/domain/entities'
import type { IEventReadRepository } from '@events/domain/ports'
import { ConfigService } from '@nestjs/config'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import type {
  IPreviewLinkReadRepository,
  IPreviewLinkWriteRepository,
} from '@previews/domain/ports'
import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { CreatePreviewLinkCommand } from './create-preview-link.command'
import { CreatePreviewLinkHandler } from './create-preview-link.handler'

describe('CreatePreviewLinkHandler', () => {
  let handler: CreatePreviewLinkHandler
  let writeRepo: jest.Mocked<Pick<IPreviewLinkWriteRepository, 'saveWithPhotos'>>
  let previewReadRepo: jest.Mocked<Pick<IPreviewLinkReadRepository, 'findOrganizerName'>>
  let eventReadRepo: jest.Mocked<Pick<IEventReadRepository, 'findByIdInScope'>>
  let photoReadRepo: jest.Mocked<Pick<IPhotoReadRepository, 'countByIdsAndEvent'>>
  let authz: jest.Mocked<IAuthorizationService>
  const unrestrictedScope = EventScope.unrestricted()
  const audit = new AuditContext('admin-1')

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
    writeRepo = { saveWithPhotos: jest.fn(async (link: never) => link) as never }
    previewReadRepo = { findOrganizerName: jest.fn().mockResolvedValue('Andes Bike') }
    eventReadRepo = { findByIdInScope: jest.fn() }
    photoReadRepo = { countByIdsAndEvent: jest.fn().mockResolvedValue(2) }
    authz = {
      can: jest.fn(),
      assert: jest.fn().mockResolvedValue(undefined),
      canAnywhere: jest.fn(),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as jest.Mocked<IAuthorizationService>

    const config = { getOrThrow: jest.fn().mockReturnValue('https://preview.example.com') }

    handler = new CreatePreviewLinkHandler(
      writeRepo as never,
      previewReadRepo as never,
      eventReadRepo as never,
      photoReadRepo as never,
      authz,
      config as unknown as ConfigService,
    )
  })

  it('throws NOT_FOUND when the event does not exist', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValue(null)
    const command = new CreatePreviewLinkCommand('missing', ['p1', 'p2'], 7, audit)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.saveWithPhotos).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the event exists but is outside the caller scope', async () => {
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    eventReadRepo.findByIdInScope.mockResolvedValue(null)
    const command = new CreatePreviewLinkCommand('other-tenant-event', ['p1'], 7, audit)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(eventReadRepo.findByIdInScope).toHaveBeenCalledWith(
      'other-tenant-event',
      restrictedScope,
    )
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.saveWithPhotos).not.toHaveBeenCalled()
  })

  it('creates the preview link once the event is verified in scope', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValue(buildEvent())
    const command = new CreatePreviewLinkCommand('event-uuid', ['p1', 'p2', 'p1'], 7, audit)

    const result = await handler.execute(command)

    expect(authz.resolveEventScope).toHaveBeenCalledWith('admin-1', 'preview_link.create')
    expect(authz.assert).toHaveBeenCalledWith('admin-1', 'preview_link.create', 'event-uuid')
    expect(photoReadRepo.countByIdsAndEvent).toHaveBeenCalledWith(['p1', 'p2'], 'event-uuid')
    expect(writeRepo.saveWithPhotos).toHaveBeenCalledWith(expect.anything(), ['p1', 'p2'])
    expect(result.previewUrl).toContain(result.token)
    expect(result.expiresAt).toBeInstanceOf(Date)
    expect(result.shareTemplate).toContain('Soy de Andes Bike')
    expect(result.shareTemplate).toContain('2 fotos')
  })

  it('rejects photos that do not belong to the event', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValue(buildEvent())
    photoReadRepo.countByIdsAndEvent.mockResolvedValue(1)
    const command = new CreatePreviewLinkCommand('event-uuid', ['p1', 'foreign'], 7, audit)

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.messageKey ?? error.message).toContain('photos_not_in_event')
    expect(writeRepo.saveWithPhotos).not.toHaveBeenCalled()
  })

  it('falls back to Titan TV when the organizer name is unknown', async () => {
    eventReadRepo.findByIdInScope.mockResolvedValue(buildEvent())
    previewReadRepo.findOrganizerName.mockResolvedValue(null)

    const result = await handler.execute(
      new CreatePreviewLinkCommand('event-uuid', ['p1', 'p2'], 7, audit),
    )

    expect(result.shareTemplate).toContain('Soy de Titan TV')
  })
})
