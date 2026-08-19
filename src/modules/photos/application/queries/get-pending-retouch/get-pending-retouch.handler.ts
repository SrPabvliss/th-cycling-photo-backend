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
   * Paid orders with at least one un-retouched photo, FIFO, scoped to the caller. Reads through
   * the orders module, which is why it was the last listing left unscoped.
   */
  async execute(query: GetPendingRetouchQuery): Promise<PendingRetouchOrderProjection[]> {
    const scope = await this.authz.resolveEventScope(query.userId)
    return this.orderReadRepo.getPendingRetouch(scope)
  }
}
