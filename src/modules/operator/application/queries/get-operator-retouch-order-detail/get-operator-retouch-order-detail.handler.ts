import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { AppException } from '@shared/domain'
import {
  type IOperatorRetouchReadRepository,
  OPERATOR_RETOUCH_READ_REPOSITORY,
} from '../../../domain/ports'
import { toOperatorRetouchOrderDetailProjection } from '../../../infrastructure/mappers/operator-retouch-order-detail.mapper'
import type { OperatorRetouchOrderDetailProjection } from '../../projections'
import { GetOperatorRetouchOrderDetailQuery } from './get-operator-retouch-order-detail.query'

@QueryHandler(GetOperatorRetouchOrderDetailQuery)
export class GetOperatorRetouchOrderDetailHandler
  implements IQueryHandler<GetOperatorRetouchOrderDetailQuery>
{
  constructor(
    @Inject(OPERATOR_RETOUCH_READ_REPOSITORY)
    private readonly retouchRead: IOperatorRetouchReadRepository,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async execute(
    query: GetOperatorRetouchOrderDetailQuery,
  ): Promise<OperatorRetouchOrderDetailProjection> {
    const row = await this.retouchRead.findOrderDetailRow(query.orderId, query.scope === 'pending')
    if (!row) {
      throw AppException.notFound('Order', query.orderId)
    }

    const isAssigned = await this.retouchRead.isOperatorAssigned(row.eventId, query.operatorId)
    if (!isAssigned) {
      throw AppException.forbidden('operator.not_assigned_to_event')
    }

    return toOperatorRetouchOrderDetailProjection(row, this.cdn)
  }
}
