import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '../../../domain/ports/tenant-payout-method-repository.port'
import type { PayoutMethodProjection } from '../../projections/payout-method.projection'
import { GetMyPayoutMethodsQuery } from './get-my-payout-methods.query'

@QueryHandler(GetMyPayoutMethodsQuery)
export class GetMyPayoutMethodsHandler implements IQueryHandler<GetMyPayoutMethodsQuery> {
  constructor(
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY) private readonly repo: ITenantPayoutMethodRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
  ) {}

  async execute(query: GetMyPayoutMethodsQuery): Promise<PayoutMethodProjection[]> {
    const tenantId = await this.userRepo.findTenantId(query.actorUserId)
    if (!tenantId) throw AppException.forbidden('tenant.not_a_tenant_member')

    const methods = await this.repo.findByTenantId(tenantId)

    return methods.map((method) => ({
      id: method.id,
      provider: method.provider,
      isActive: method.isActive,
      sortOrder: method.sortOrder,
      status: method.status,
      receiverIdentifier: method.receiverIdentifier,
      bankName: method.bankName,
      accountNumber: method.accountNumber,
      accountType: method.accountType,
      accountHolder: method.accountHolder,
      holderIdentification: method.holderIdentification,
      verifiedAt: method.verifiedAt,
    }))
  }
}
