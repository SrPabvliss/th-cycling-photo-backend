import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { PreviewLinkCreatedProjection } from '@previews/application/projections'
import { PreviewLink } from '@previews/domain/entities'
import {
  type IPreviewLinkWriteRepository,
  PREVIEW_LINK_WRITE_REPOSITORY,
} from '@previews/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { CreatePreviewLinkCommand } from './create-preview-link.command'

@CommandHandler(CreatePreviewLinkCommand)
export class CreatePreviewLinkHandler implements ICommandHandler<CreatePreviewLinkCommand> {
  private readonly previewBaseUrl: string

  constructor(
    @Inject(PREVIEW_LINK_WRITE_REPOSITORY) private readonly writeRepo: IPreviewLinkWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    config: ConfigService,
  ) {
    this.previewBaseUrl = config.getOrThrow<string>('preview.baseUrl')
  }

  async execute(command: CreatePreviewLinkCommand): Promise<PreviewLinkCreatedProjection> {
    // Scoped load, then assert — see Ruling 21. The scoped load is what
    // enforces the tenant boundary; `assert` alone never compares the
    // event's tenant to the caller's.
    const scope = await this.authz.resolveEventScope(command.audit.userId)
    const event = await this.eventReadRepo.findByIdInScope(command.eventId, scope)
    if (!event) throw AppException.notFound('entities.event', command.eventId)
    await this.authz.assert(command.audit.userId, 'preview_link.create', event.id)

    // Validate photos belong to this event
    const photoCount = await this.photoReadRepo.countByIds(command.photoIds)
    if (photoCount !== command.photoIds.length) {
      throw AppException.businessRule('preview.photos_not_in_event')
    }

    // Create preview link entity
    const previewLink = PreviewLink.create({
      eventId: command.eventId,
      expiresInDays: command.expiresInDays,
      createdById: command.audit.userId,
    })

    // Persist preview link + photo associations
    const saved = await this.writeRepo.save(previewLink)
    await this.writeRepo.savePhotos(saved.id, command.photoIds)

    // Build response
    const previewUrl = `${this.previewBaseUrl}/${saved.token}`
    const shareTemplate = `¡Hola! \u{1F44B} Soy de Titan TV. Encontramos ${command.photoIds.length} fotos tuyas del evento "${event.name}". Revísalas aquí: ${previewUrl}. Selecciona las que quieras y completa el formulario. ¡Estaremos atentos! \u{1F4F8}`

    return {
      id: saved.id,
      token: saved.token,
      previewUrl,
      shareTemplate,
    }
  }
}
