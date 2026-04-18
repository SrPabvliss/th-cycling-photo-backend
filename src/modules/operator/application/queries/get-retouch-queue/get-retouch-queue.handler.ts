import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IOperatorRetouchRepository, OPERATOR_RETOUCH_REPOSITORY } from '../../../domain/ports'
import type { RetouchQueueProjection } from '../../projections'
import { GetRetouchQueueQuery } from './get-retouch-queue.query'

@QueryHandler(GetRetouchQueueQuery)
export class GetRetouchQueueHandler implements IQueryHandler<GetRetouchQueueQuery> {
  constructor(
    @Inject(OPERATOR_RETOUCH_REPOSITORY)
    private readonly retouchRepo: IOperatorRetouchRepository,
  ) {}

  async execute(query: GetRetouchQueueQuery): Promise<RetouchQueueProjection> {
    const isAssigned = await this.retouchRepo.isOperatorAssigned(query.eventId, query.operatorId)
    if (!isAssigned) {
      throw AppException.forbidden('operator.not_assigned_to_event')
    }

    return this.retouchRepo.getRetouchQueue(query.eventId)
  }
}
