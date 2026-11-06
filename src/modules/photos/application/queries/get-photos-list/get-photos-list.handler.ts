import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PhotoListProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { PaginatedResult } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetPhotosListQuery } from './get-photos-list.query'

@QueryHandler(GetPhotosListQuery)
export class GetPhotosListHandler implements IQueryHandler<GetPhotosListQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /** Retrieves a paginated list of photos for a given event, scoped to the caller. */
  async execute(query: GetPhotosListQuery): Promise<PaginatedResult<PhotoListProjection>> {
    const scope = await this.authz.resolveEventScope(query.userId)
    const event = await this.eventReadRepo.findById(query.eventId)
    if (!event || !scope.includesEvent(event)) {
      throw AppException.notFound('Event', query.eventId)
    }
    await this.authz.assert(query.userId, 'photo.read', event.id)
    return this.readRepo.getPhotosList(query.eventId, query.pagination, query.filters, scope)
  }
}
