import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PreviewLinkListProjection } from '@previews/application/projections'
import {
  type IPreviewLinkReadRepository,
  PREVIEW_LINK_READ_REPOSITORY,
} from '@previews/domain/ports'
import type { PaginatedResult } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { GetPreviewLinksListQuery } from './get-preview-links-list.query'

@QueryHandler(GetPreviewLinksListQuery)
export class GetPreviewLinksListHandler implements IQueryHandler<GetPreviewLinksListQuery> {
  constructor(
    @Inject(PREVIEW_LINK_READ_REPOSITORY) private readonly readRepo: IPreviewLinkReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /** Lists preview links for an event, restricted to events within the caller's scope. */
  async execute(
    query: GetPreviewLinksListQuery,
  ): Promise<PaginatedResult<PreviewLinkListProjection>> {
    const scope = await this.authz.resolveEventScope(query.userId)
    return this.readRepo.getListByEvent(query.eventId, query.pagination, scope)
  }
}
