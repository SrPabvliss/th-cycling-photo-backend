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
import { AppException } from '@shared/domain'
import { CreatePreviewLinkCommand } from './create-preview-link.command'

@CommandHandler(CreatePreviewLinkCommand)
export class CreatePreviewLinkHandler implements ICommandHandler<CreatePreviewLinkCommand> {
  private readonly previewBaseUrl: string

  constructor(
    @Inject(PREVIEW_LINK_WRITE_REPOSITORY) private readonly writeRepo: IPreviewLinkWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    config: ConfigService,
  ) {
    this.previewBaseUrl = config.getOrThrow<string>('preview.baseUrl')
  }

  async execute(command: CreatePreviewLinkCommand): Promise<PreviewLinkCreatedProjection> {
    // Validate event exists
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('entities.event', command.eventId)

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
    const shareTemplate = `¡Hola! 👋 Soy de Titan TV. Encontramos ${command.photoIds.length} fotos tuyas del evento "${event.name}". Revísalas aquí: ${previewUrl}. Selecciona las que quieras y completa el formulario. ¡Estaremos atentos! 📸`

    return {
      id: saved.id,
      token: saved.token,
      previewUrl,
      shareTemplate,
    }
  }
}
