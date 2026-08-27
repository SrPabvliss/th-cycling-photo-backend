import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PaginatedResult } from '@shared/application'
import {
  type IOrganizerReadRepository,
  ORGANIZER_READ_REPOSITORY,
} from '../../../domain/ports/organizer-read-repository.port'
import type { OrganizerRowProjection } from '../../projections/organizer-list.projection'
import { GetOrganizersListQuery } from './get-organizers-list.query'

@QueryHandler(GetOrganizersListQuery)
export class GetOrganizersListHandler implements IQueryHandler<GetOrganizersListQuery> {
  constructor(
    @Inject(ORGANIZER_READ_REPOSITORY)
    private readonly organizerReadRepo: IOrganizerReadRepository,
  ) {}

  async execute(query: GetOrganizersListQuery): Promise<PaginatedResult<OrganizerRowProjection>> {
    return this.organizerReadRepo.getOrganizersPage(query.filters, query.pagination)
  }
}
