import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import type { PendingRetouchOrderProjection } from '@photos/application/projections'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { GetPendingRetouchQuery } from './get-pending-retouch.query'

@QueryHandler(GetPendingRetouchQuery)
export class GetPendingRetouchHandler implements IQueryHandler<GetPendingRetouchQuery> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly orderReadRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  /**
   * Returns paid orders that have at least one un-retouched photo, ordered
   * FIFO, scoped to the caller. Closes the gap Task 11 documented and left
   * open: this route reads through the orders module (out of Task 11's
   * file boundary), so it stayed unscoped even though every other
   * single-entity read/listing in the platform was closed by that point.
   */
  async execute(query: GetPendingRetouchQuery): Promise<PendingRetouchOrderProjection[]> {
    const scope = await this.authz.resolveEventScope(query.userId)
    return this.orderReadRepo.getPendingRetouch(scope)
  }
}
