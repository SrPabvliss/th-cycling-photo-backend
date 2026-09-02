import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import type { IUserReadRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY } from '@users/domain/ports'
import type { BuyerDetailProjection } from '../../projections'
import { GetBuyerDetailQuery } from './get-buyer-detail.query'

@QueryHandler(GetBuyerDetailQuery)
export class GetBuyerDetailHandler implements IQueryHandler<GetBuyerDetailQuery> {
  constructor(@Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository) {}

  async execute(query: GetBuyerDetailQuery): Promise<BuyerDetailProjection> {
    const buyer = await this.readRepo.getBuyerDetail(query.id)
    if (!buyer) throw AppException.notFound('entities.buyer', query.id)
    return buyer
  }
}
