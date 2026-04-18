import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import type { PendingRetouchOrderProjection } from '@photos/application/projections'
import { GetPendingRetouchQuery } from './get-pending-retouch.query'

@QueryHandler(GetPendingRetouchQuery)
export class GetPendingRetouchHandler implements IQueryHandler<GetPendingRetouchQuery> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly orderReadRepo: IOrderReadRepository,
  ) {}

  /** Returns paid orders that have at least one un-retouched photo, ordered FIFO. */
  async execute(_query: GetPendingRetouchQuery): Promise<PendingRetouchOrderProjection[]> {
    return this.orderReadRepo.getPendingRetouch()
  }
}
