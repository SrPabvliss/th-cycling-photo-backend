import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import {
  normalizeEcuadorPhone,
  PAYMENT_GATEWAY_REGISTRY,
  PAYPHONE_PROVIDER,
  type PaymentGatewayRegistry,
} from '@shared/payment-gateways'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import { TenantPayoutMethod } from '../../../domain/entities/tenant-payout-method.entity'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '../../../domain/ports/tenant-payout-method-repository.port'
import { PayoutProvider } from '../../../domain/value-objects/payout-provider.vo'
import { CreatePayoutMethodCommand } from './create-payout-method.command'

@CommandHandler(CreatePayoutMethodCommand)
export class CreatePayoutMethodHandler implements ICommandHandler<CreatePayoutMethodCommand> {
  constructor(
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY) private readonly repo: ITenantPayoutMethodRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(PAYMENT_GATEWAY_REGISTRY) private readonly registry: PaymentGatewayRegistry,
  ) {}

  async execute(command: CreatePayoutMethodCommand): Promise<EntityIdProjection> {
    const tenantId = await this.userRepo.findTenantId(command.actorUserId)
    if (!tenantId) throw AppException.forbidden('tenant.not_a_tenant_member')

    const method =
      command.provider === PayoutProvider.PAYPHONE
        ? await this.buildPayphone(command, tenantId)
        : this.buildBankTransfer(command, tenantId)

    const existing = await this.repo.findByTenantId(tenantId)
    method.reorder(existing.length)
    await this.repo.save(method)

    return { id: method.id }
  }

  private async buildPayphone(
    command: CreatePayoutMethodCommand,
    tenantId: string,
  ): Promise<TenantPayoutMethod> {
    if (!command.phone) throw AppException.businessRule('payment.invalid_phone')

    const gateway = this.registry.get(PAYPHONE_PROVIDER)
    const registered = await gateway.verifyReceiver(command.phone, gateway.platformCredentials())
    if (!registered) throw AppException.businessRule('payment.phone_not_registered')

    const method = TenantPayoutMethod.createPayphoneSplit(
      tenantId,
      normalizeEcuadorPhone(command.phone),
      command.actorUserId,
    )
    method.markVerified()
    return method
  }

  private buildBankTransfer(
    command: CreatePayoutMethodCommand,
    tenantId: string,
  ): TenantPayoutMethod {
    if (!command.bank) throw AppException.businessRule('payment.invalid_bank_details')
    return TenantPayoutMethod.createBankTransfer(tenantId, command.bank, command.actorUserId)
  }
}
