import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PreviewLinkListProjection } from '@previews/application/projections'
import {
  type IPreviewLinkReadRepository,
  PREVIEW_LINK_READ_REPOSITORY,
} from '@previews/domain/ports'
import type { PaginatedResult } from '@shared/application'
import { GetPreviewLinksListQuery } from './get-preview-links-list.query'

@QueryHandler(GetPreviewLinksListQuery)
export class GetPreviewLinksListHandler implements IQueryHandler<GetPreviewLinksListQuery> {
  constructor(
    @Inject(PREVIEW_LINK_READ_REPOSITORY) private readonly readRepo: IPreviewLinkReadRepository,
  ) {}

  async execute(
    query: GetPreviewLinksListQuery,
  ): Promise<PaginatedResult<PreviewLinkListProjection>> {
    return this.readRepo.getListByEvent(query.eventId, query.pagination)
  }
}
