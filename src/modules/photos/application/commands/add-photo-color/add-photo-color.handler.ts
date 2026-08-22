import { PhotoColor } from '@classifications/domain/entities'
import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoColorWriteRepository,
  type IPhotoReadRepository,
  PHOTO_COLOR_WRITE_REPOSITORY,
  PHOTO_READ_REPOSITORY,
} from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { AddPhotoColorCommand } from './add-photo-color.command'

@CommandHandler(AddPhotoColorCommand)
export class AddPhotoColorHandler implements ICommandHandler<AddPhotoColorCommand> {
  private readonly logger = new Logger('ReviewAudit')

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_COLOR_WRITE_REPOSITORY)
    private readonly colorRepo: IPhotoColorWriteRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly freeze: FreezeStateService,
  ) {}

  async execute(cmd: AddPhotoColorCommand): Promise<{ colorId: string; photoId: string }> {
    const scope = await this.authz.resolveEventScope(cmd.reviewerId)
    const photo = await this.photoReadRepo.findByIdInScope(cmd.photoId, scope)
    if (!photo) throw AppException.notFound('Photo', cmd.photoId)
    await this.authz.assert(cmd.reviewerId, 'photo.color.create', photo.eventId)
    await this.freeze.assertNotFrozen(photo.eventId)
    if (photo.status === 'processing') {
      throw AppException.businessRule('photo.processing_in_progress')
    }

    const color = PhotoColor.createManual({
      photoId: cmd.photoId,
      region: cmd.region,
      primaryColor: cmd.primaryColor,
      secondaryColor: cmd.secondaryColor,
      reviewerId: cmd.reviewerId,
    })
    await this.colorRepo.save(color)

    this.logger.log({
      event: 'photo_attribute_added_manual',
      photo_id: cmd.photoId,
      reviewer_id: cmd.reviewerId,
      attribute_type: 'photo_color',
      attribute_id: color.id,
      payload: {
        region: color.region,
        primary_color: color.primaryColor,
        secondary_color: color.secondaryColor,
      },
    })

    return { colorId: color.id, photoId: cmd.photoId }
  }
}
