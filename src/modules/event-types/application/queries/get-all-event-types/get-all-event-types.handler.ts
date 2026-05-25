import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { EVENT_TYPE_READ_REPOSITORY, type IEventTypeReadRepository } from '../../../domain/ports'
import type { EventTypeProjection } from '../../projections'
import { GetAllEventTypesQuery } from './get-all-event-types.query'

@QueryHandler(GetAllEventTypesQuery)
export class GetAllEventTypesHandler implements IQueryHandler<GetAllEventTypesQuery> {
  constructor(
    @Inject(EVENT_TYPE_READ_REPOSITORY) private readonly readRepo: IEventTypeReadRepository,
  ) {}

  async execute(_query: GetAllEventTypesQuery): Promise<EventTypeProjection[]> {
    return this.readRepo.findAll()
  }
}
