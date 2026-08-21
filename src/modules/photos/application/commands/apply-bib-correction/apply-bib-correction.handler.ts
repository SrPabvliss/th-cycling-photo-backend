import { CorrectionTargetType } from '@generated/prisma/client'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  CORRECTION_REPOSITORY,
  type ICorrectionRepository,
  type IPhotoBibWriteRepository,
  type IPhotoReadRepository,
  PHOTO_BIB_WRITE_REPOSITORY,
  PHOTO_READ_REPOSITORY,
} from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { ApplyBibCorrectionCommand } from './apply-bib-correction.command'

@CommandHandler(ApplyBibCorrectionCommand)
export class ApplyBibCorrectionHandler implements ICommandHandler<ApplyBibCorrectionCommand> {
  private readonly logger = new Logger('ReviewAudit')

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_BIB_WRITE_REPOSITORY) private readonly bibRepo: IPhotoBibWriteRepository,
    @Inject(CORRECTION_REPOSITORY) private readonly correctionRepo: ICorrectionRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(
    cmd: ApplyBibCorrectionCommand,
  ): Promise<{ changed: boolean; correctionId?: string }> {
    const scope = await this.authz.resolveEventScope(cmd.reviewerId)
    const photo = await this.photoReadRepo.findByIdInScope(cmd.photoId, scope)
    if (!photo) throw AppException.notFound('Photo', cmd.photoId)
    await this.authz.assert(cmd.reviewerId, 'photo.bib.correct', photo.eventId)
    if (photo.status === 'processing') {
      throw AppException.businessRule('photo.processing_in_progress')
    }

    const bib = await this.bibRepo.findById(cmd.bibId)
    if (!bib || bib.photoId !== cmd.photoId) {
      throw AppException.notFound('PhotoBib', cmd.bibId)
    }

    if (!/^[0-9]{1,6}$/.test(cmd.newValue)) {
      throw AppException.businessRule('correction.invalid_digits')
    }

    const latest = await this.correctionRepo.findLatestForTarget(
      CorrectionTargetType.photo_bib,
      cmd.bibId,
      'digits',
    )
    const effective = latest?.newValue ?? bib.digits

    if (cmd.newValue === effective) {
      this.logger.log({
        event: 'photo_correction_applied',
        photo_id: cmd.photoId,
        reviewer_id: cmd.reviewerId,
        target_type: 'photo_bib',
        target_id: cmd.bibId,
        field: 'digits',
        old_value: effective,
        new_value: cmd.newValue,
        is_no_op: true,
      })
      return { changed: false }
    }

    const correction = await this.correctionRepo.appendCorrection({
      photoId: cmd.photoId,
      targetType: CorrectionTargetType.photo_bib,
      targetId: cmd.bibId,
      field: 'digits',
      oldValue: effective,
      newValue: cmd.newValue,
      reviewerId: cmd.reviewerId,
    })

    this.logger.log({
      event: 'photo_correction_applied',
      photo_id: cmd.photoId,
      reviewer_id: cmd.reviewerId,
      target_type: 'photo_bib',
      target_id: cmd.bibId,
      field: 'digits',
      old_value: effective,
      new_value: cmd.newValue,
      is_no_op: false,
      correction_id: correction.id,
    })
    return { changed: true, correctionId: correction.id }
  }
}
