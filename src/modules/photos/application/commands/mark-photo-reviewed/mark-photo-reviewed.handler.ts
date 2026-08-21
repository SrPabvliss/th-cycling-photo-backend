import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoReadRepository,
  type IPhotoWriteRepository,
  PHOTO_READ_REPOSITORY,
  PHOTO_WRITE_REPOSITORY,
} from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { MarkPhotoReviewedCommand } from './mark-photo-reviewed.command'

@CommandHandler(MarkPhotoReviewedCommand)
export class MarkPhotoReviewedHandler implements ICommandHandler<MarkPhotoReviewedCommand> {
  private readonly logger = new Logger('ReviewAudit')

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly photoWriteRepo: IPhotoWriteRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(cmd: MarkPhotoReviewedCommand): Promise<{ photoId: string; reviewedAt: Date }> {
    const scope = await this.authz.resolveEventScope(cmd.reviewerId)
    const photo = await this.photoReadRepo.findByIdInScope(cmd.photoId, scope)
    if (!photo) throw AppException.notFound('Photo', cmd.photoId)
    await this.authz.assert(cmd.reviewerId, 'photo.review', photo.eventId)
    if (photo.status === 'processing') {
      throw AppException.businessRule('photo.processing_in_progress')
    }

    const wasAlreadyReviewed = photo.reviewedAt !== null
    photo.markReviewed()
    await this.photoWriteRepo.save(photo)

    this.logger.log({
      event: 'photo_marked_reviewed',
      photo_id: cmd.photoId,
      reviewer_id: cmd.reviewerId,
      was_already_reviewed: wasAlreadyReviewed,
    })

    return { photoId: cmd.photoId, reviewedAt: photo.reviewedAt as Date }
  }
}
