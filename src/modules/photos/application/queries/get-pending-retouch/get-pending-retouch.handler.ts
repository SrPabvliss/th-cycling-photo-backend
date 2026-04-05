import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import type { PendingRetouchOrderProjection } from '@photos/application/projections'
import { GetPendingRetouchQuery } from './get-pending-retouch.query'

@QueryHandler(GetPendingRetouchQuery)
export class GetPendingRetouchHandler implements IQueryHandler<GetPendingRetouchQuery> {
  private readonly cdnUrl: string | undefined

  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly orderReadRepo: IOrderReadRepository,
    config: ConfigService,
  ) {
    this.cdnUrl = config.get<string>('storage.cdnUrl')
  }

  /** Returns paid orders that have at least one un-retouched photo, ordered FIFO. */
  async execute(_query: GetPendingRetouchQuery): Promise<PendingRetouchOrderProjection[]> {
    return this.orderReadRepo.getPendingRetouch(this.cdnUrl)
  }
}
