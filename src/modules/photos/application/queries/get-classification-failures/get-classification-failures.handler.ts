import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import type { ClassificationFailuresProjection } from '../../projections'
import { GetClassificationFailuresQuery } from './get-classification-failures.query'

@QueryHandler(GetClassificationFailuresQuery)
export class GetClassificationFailuresHandler
  implements IQueryHandler<GetClassificationFailuresQuery>
{
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(query: GetClassificationFailuresQuery): Promise<ClassificationFailuresProjection> {
    const scope = await this.authz.resolveEventScope(query.userId)
    const event = await this.eventReadRepo.findById(query.eventId)
    if (!event || !scope.includesEvent(event)) {
      throw AppException.notFound('Event', query.eventId)
    }
    await this.authz.assert(query.userId, 'photo.classification.retry', event.id)
    return { failedCount: await this.photoReadRepo.countFailedByEvent(query.eventId) }
  }
}
