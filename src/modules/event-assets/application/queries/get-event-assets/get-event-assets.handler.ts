import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { EVENT_ASSET_READ_REPOSITORY, type IEventAssetReadRepository } from '../../../domain/ports'
import type { EventAssetProjection } from '../../projections'
import { GetEventAssetsQuery } from './get-event-assets.query'

@QueryHandler(GetEventAssetsQuery)
export class GetEventAssetsHandler implements IQueryHandler<GetEventAssetsQuery> {
  constructor(
    @Inject(EVENT_ASSET_READ_REPOSITORY) private readonly readRepo: IEventAssetReadRepository,
  ) {}

  async execute(query: GetEventAssetsQuery): Promise<EventAssetProjection[]> {
    return this.readRepo.getByEvent(query.eventId)
  }
}
