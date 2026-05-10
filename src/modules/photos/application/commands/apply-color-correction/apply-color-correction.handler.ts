import { CorrectionTargetType } from '@generated/prisma/client'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  CORRECTION_REPOSITORY,
  type ICorrectionRepository,
  type IPhotoColorWriteRepository,
  type IPhotoReadRepository,
  PHOTO_COLOR_WRITE_REPOSITORY,
  PHOTO_READ_REPOSITORY,
} from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { ApplyColorCorrectionCommand } from './apply-color-correction.command'

@CommandHandler(ApplyColorCorrectionCommand)
export class ApplyColorCorrectionHandler implements ICommandHandler<ApplyColorCorrectionCommand> {
  private readonly logger = new Logger('ReviewAudit')

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_COLOR_WRITE_REPOSITORY) private readonly colorRepo: IPhotoColorWriteRepository,
    @Inject(CORRECTION_REPOSITORY) private readonly correctionRepo: ICorrectionRepository,
  ) {}

  async execute(
    cmd: ApplyColorCorrectionCommand,
  ): Promise<{ changed: boolean; correctionId?: string }> {
    const photo = await this.photoReadRepo.findById(cmd.photoId)
    if (!photo) throw AppException.notFound('Photo', cmd.photoId)
    if (photo.status === 'processing') {
      throw AppException.businessRule('photo.processing_in_progress')
    }

    const color = await this.colorRepo.findById(cmd.colorId)
    if (!color || color.photoId !== cmd.photoId) {
      throw AppException.notFound('PhotoColor', cmd.colorId)
    }

    const original = cmd.field === 'primary_color' ? color.primaryColor : color.secondaryColor

    const latest = await this.correctionRepo.findLatestForTarget(
      CorrectionTargetType.photo_color,
      cmd.colorId,
      cmd.field,
    )
    const effective = latest?.newValue ?? original

    if (cmd.newValue === effective) {
      this.logger.log({
        event: 'photo_correction_applied',
        photo_id: cmd.photoId,
        reviewer_id: cmd.reviewerId,
        target_type: 'photo_color',
        target_id: cmd.colorId,
        field: cmd.field,
        old_value: effective,
        new_value: cmd.newValue,
        is_no_op: true,
      })
      return { changed: false }
    }

    const correction = await this.correctionRepo.appendCorrection({
      photoId: cmd.photoId,
      targetType: CorrectionTargetType.photo_color,
      targetId: cmd.colorId,
      field: cmd.field,
      oldValue: effective,
      newValue: cmd.newValue,
      reviewerId: cmd.reviewerId,
    })

    this.logger.log({
      event: 'photo_correction_applied',
      photo_id: cmd.photoId,
      reviewer_id: cmd.reviewerId,
      target_type: 'photo_color',
      target_id: cmd.colorId,
      field: cmd.field,
      old_value: effective,
      new_value: cmd.newValue,
      is_no_op: false,
      correction_id: correction.id,
    })
    return { changed: true, correctionId: correction.id }
  }
}
