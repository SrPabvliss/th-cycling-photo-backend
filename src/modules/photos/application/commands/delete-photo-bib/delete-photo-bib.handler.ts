import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoBibWriteRepository,
  type IPhotoReadRepository,
  PHOTO_BIB_WRITE_REPOSITORY,
  PHOTO_READ_REPOSITORY,
} from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { DeletePhotoBibCommand } from './delete-photo-bib.command'

@CommandHandler(DeletePhotoBibCommand)
export class DeletePhotoBibHandler implements ICommandHandler<DeletePhotoBibCommand> {
  private readonly logger = new Logger('ReviewAudit')

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_BIB_WRITE_REPOSITORY) private readonly bibRepo: IPhotoBibWriteRepository,
  ) {}

  async execute(cmd: DeletePhotoBibCommand): Promise<{ bibId: string; photoId: string }> {
    const photo = await this.photoReadRepo.findById(cmd.photoId)
    if (!photo) throw AppException.notFound('Photo', cmd.photoId)
    if (photo.status === 'processing') {
      throw AppException.businessRule('photo.processing_in_progress')
    }

    const bib = await this.bibRepo.findById(cmd.bibId)
    if (!bib || bib.photoId !== cmd.photoId) {
      throw AppException.notFound('PhotoBib', cmd.bibId)
    }

    await this.bibRepo.softDelete(cmd.bibId, cmd.reviewerId)

    this.logger.log({
      event: 'photo_attribute_soft_deleted',
      photo_id: cmd.photoId,
      reviewer_id: cmd.reviewerId,
      attribute_type: 'photo_bib',
      attribute_id: cmd.bibId,
      payload: { digits: bib.digits },
    })

    return { bibId: cmd.bibId, photoId: cmd.photoId }
  }
}
