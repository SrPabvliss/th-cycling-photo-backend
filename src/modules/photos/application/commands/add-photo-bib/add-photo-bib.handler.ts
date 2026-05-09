import { PhotoBib } from '@classifications/domain/entities'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoBibWriteRepository,
  type IPhotoReadRepository,
  PHOTO_BIB_WRITE_REPOSITORY,
  PHOTO_READ_REPOSITORY,
} from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { AddPhotoBibCommand } from './add-photo-bib.command'

@CommandHandler(AddPhotoBibCommand)
export class AddPhotoBibHandler implements ICommandHandler<AddPhotoBibCommand> {
  private readonly logger = new Logger('ReviewAudit')

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_BIB_WRITE_REPOSITORY) private readonly bibRepo: IPhotoBibWriteRepository,
  ) {}

  async execute(cmd: AddPhotoBibCommand): Promise<{ bibId: string; photoId: string }> {
    const photo = await this.photoReadRepo.findById(cmd.photoId)
    if (!photo) throw AppException.notFound('Photo', cmd.photoId)
    if (photo.status === 'processing') {
      throw AppException.businessRule('photo.processing_in_progress')
    }
    if (!/^[0-9]{1,6}$/.test(cmd.digits)) {
      throw AppException.businessRule('bib.invalid_digits')
    }

    const bib = PhotoBib.createManual({
      photoId: cmd.photoId,
      digits: cmd.digits,
      status: cmd.status,
      reviewerId: cmd.reviewerId,
    })
    await this.bibRepo.save(bib)

    this.logger.log({
      event: 'photo_attribute_added_manual',
      photo_id: cmd.photoId,
      reviewer_id: cmd.reviewerId,
      attribute_type: 'photo_bib',
      attribute_id: bib.id,
      payload: { digits: bib.digits, status: bib.status },
    })

    return { bibId: bib.id, photoId: cmd.photoId }
  }
}
