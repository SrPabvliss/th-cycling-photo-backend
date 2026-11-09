import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import {
  type IOrganizerReadRepository,
  ORGANIZER_READ_REPOSITORY,
} from '../../../domain/ports/organizer-read-repository.port'
import type { OrganizerDetailProjection } from '../../projections/organizer-detail.projection'
import { GetOrganizerDetailQuery } from './get-organizer-detail.query'

@QueryHandler(GetOrganizerDetailQuery)
export class GetOrganizerDetailHandler implements IQueryHandler<GetOrganizerDetailQuery> {
  constructor(
    @Inject(ORGANIZER_READ_REPOSITORY)
    private readonly organizerReadRepo: IOrganizerReadRepository,
  ) {}

  async execute(query: GetOrganizerDetailQuery): Promise<OrganizerDetailProjection> {
    const detail = await this.organizerReadRepo.getOrganizerDetail(query.id)
    if (!detail) throw AppException.notFound('entities.tenant', query.id)
    return detail
  }
}
