import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import {
  normalizeEcuadorPhone,
  PAYMENT_GATEWAY_REGISTRY,
  PAYPHONE_PROVIDER,
  type PaymentGatewayRegistry,
} from '@shared/payment-gateways'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import { VerifyPayoutReceiverQuery } from './verify-payout-receiver.query'

@QueryHandler(VerifyPayoutReceiverQuery)
export class VerifyPayoutReceiverHandler implements IQueryHandler<VerifyPayoutReceiverQuery> {
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(PAYMENT_GATEWAY_REGISTRY) private readonly registry: PaymentGatewayRegistry,
  ) {}

  async execute(query: VerifyPayoutReceiverQuery): Promise<{ registered: boolean }> {
    const tenantId = await this.userRepo.findTenantId(query.actorUserId)
    if (!tenantId) throw AppException.forbidden('tenant.not_a_tenant_member')

    const gateway = this.registry.get(PAYPHONE_PROVIDER)
    const phone = normalizeEcuadorPhone(query.phone)
    const registered = await gateway.verifyReceiver(phone, gateway.platformCredentials())

    return { registered }
  }
}
