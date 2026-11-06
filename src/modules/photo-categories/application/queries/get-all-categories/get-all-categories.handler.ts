import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import type { PhotoCategoryProjection } from '../../../application/projections'
import {
  type IPhotoCategoryReadRepository,
  PHOTO_CATEGORY_READ_REPOSITORY,
} from '../../../domain/ports'
import { GetAllCategoriesQuery } from './get-all-categories.query'

/**
 * The categories an organizer may pick: the base set plus their own. For an event, the organizer
 * is the event's owner — which is how an admin managing another tenant's event sees that tenant's.
 */
@QueryHandler(GetAllCategoriesQuery)
export class GetAllCategoriesHandler implements IQueryHandler<GetAllCategoriesQuery> {
  constructor(
    @Inject(PHOTO_CATEGORY_READ_REPOSITORY) private readonly readRepo: IPhotoCategoryReadRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(query: GetAllCategoriesQuery): Promise<PhotoCategoryProjection[]> {
    if (query.eventId === null) {
      return this.readRepo.getAvailable(await this.userRepo.findTenantId(query.userId))
    }

    const scope = await this.authz.resolveEventScope(query.userId, 'event.read')
    const event = await this.eventReadRepo.findByIdInScope(query.eventId, scope)
    if (!event) throw AppException.notFound('Event', query.eventId)
    return this.readRepo.getAvailable(event.tenantId)
  }
}
