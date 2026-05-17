import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { AppException } from '@shared/domain'
import {
  type IOperatorRetouchReadRepository,
  OPERATOR_RETOUCH_READ_REPOSITORY,
} from '../../../domain/ports'
import { toRetouchQueueProjection } from '../../../infrastructure/mappers/retouch-queue.mapper'
import type { RetouchQueueProjection } from '../../projections'
import { GetRetouchQueueQuery } from './get-retouch-queue.query'

@QueryHandler(GetRetouchQueueQuery)
export class GetRetouchQueueHandler implements IQueryHandler<GetRetouchQueueQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY)
    private readonly eventRead: IEventReadRepository,
    @Inject(OPERATOR_RETOUCH_READ_REPOSITORY)
    private readonly retouchRead: IOperatorRetouchReadRepository,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async execute(query: GetRetouchQueueQuery): Promise<RetouchQueueProjection> {
    const event = await this.eventRead.existsActiveEventBySlug(query.eventSlug)
    if (!event) {
      throw AppException.notFound('Event', query.eventSlug)
    }

    const isAssigned = await this.retouchRead.isOperatorAssigned(event.id, query.operatorId)
    if (!isAssigned) {
      throw AppException.forbidden('operator.not_assigned_to_event')
    }

    const rows = await this.retouchRead.getRetouchQueueRows(event.id, query.scope)
    return toRetouchQueueProjection(rows, this.cdn)
  }
}
