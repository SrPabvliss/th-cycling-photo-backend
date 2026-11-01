import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoClassificationQueue,
  type IPhotoReadRepository,
  PHOTO_CLASSIFICATION_QUEUE,
  PHOTO_READ_REPOSITORY,
} from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import type { ReclassifyPhotosResultProjection } from '../../projections'
import { ReclassifyPhotosCommand } from './reclassify-photos.command'

@CommandHandler(ReclassifyPhotosCommand)
export class ReclassifyPhotosHandler implements ICommandHandler<ReclassifyPhotosCommand> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_CLASSIFICATION_QUEUE)
    private readonly classificationQueue: IPhotoClassificationQueue,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly freeze: FreezeStateService,
  ) {}

  async execute(command: ReclassifyPhotosCommand): Promise<ReclassifyPhotosResultProjection> {
    const scope = await this.authz.resolveEventScope(command.userId)
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event || !scope.includesEvent(event)) {
      throw AppException.notFound('Event', command.eventId)
    }
    await this.authz.assert(command.userId, 'photo.classification.retry', event.id)
    await this.freeze.assertNotFrozen(command.eventId)

    const failed = await this.photoReadRepo.getFailedPhotoIds(command.eventId, command.photoIds)
    const live = await this.classificationQueue.getLivePhotoIds()
    const toEnqueue = failed.filter((photoId) => !live.has(photoId))
    await this.classificationQueue.enqueue(toEnqueue)

    const requested = command.photoIds?.length ?? failed.length
    return { enqueued: toEnqueue.length, ignored: requested - toEnqueue.length }
  }
}
