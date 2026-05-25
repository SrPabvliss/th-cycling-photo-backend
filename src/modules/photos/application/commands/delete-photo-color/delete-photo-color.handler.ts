import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoColorWriteRepository,
  type IPhotoReadRepository,
  PHOTO_COLOR_WRITE_REPOSITORY,
  PHOTO_READ_REPOSITORY,
} from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { DeletePhotoColorCommand } from './delete-photo-color.command'

@CommandHandler(DeletePhotoColorCommand)
export class DeletePhotoColorHandler implements ICommandHandler<DeletePhotoColorCommand> {
  private readonly logger = new Logger('ReviewAudit')

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_COLOR_WRITE_REPOSITORY) private readonly colorRepo: IPhotoColorWriteRepository,
  ) {}

  async execute(cmd: DeletePhotoColorCommand): Promise<{ colorId: string; photoId: string }> {
    const photo = await this.photoReadRepo.findById(cmd.photoId)
    if (!photo) throw AppException.notFound('Photo', cmd.photoId)
    if (photo.status === 'processing') {
      throw AppException.businessRule('photo.processing_in_progress')
    }

    const color = await this.colorRepo.findById(cmd.colorId)
    if (!color || color.photoId !== cmd.photoId) {
      throw AppException.notFound('PhotoColor', cmd.colorId)
    }

    await this.colorRepo.softDelete(cmd.colorId, cmd.reviewerId)

    this.logger.log({
      event: 'photo_attribute_soft_deleted',
      photo_id: cmd.photoId,
      reviewer_id: cmd.reviewerId,
      attribute_type: 'photo_color',
      attribute_id: cmd.colorId,
      payload: { region: color.region },
    })

    return { colorId: cmd.colorId, photoId: cmd.photoId }
  }
}
