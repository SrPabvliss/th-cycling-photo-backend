import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import {
  normalizeEcuadorPhone,
  PAYMENT_GATEWAY_REGISTRY,
  PAYPHONE_PROVIDER,
  type PaymentGatewayRegistry,
} from '@shared/payment-gateways'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '../../../domain/ports/tenant-payout-method-repository.port'
import { UpdatePayoutMethodCommand } from './update-payout-method.command'

@CommandHandler(UpdatePayoutMethodCommand)
export class UpdatePayoutMethodHandler implements ICommandHandler<UpdatePayoutMethodCommand> {
  constructor(
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY) private readonly repo: ITenantPayoutMethodRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(PAYMENT_GATEWAY_REGISTRY) private readonly registry: PaymentGatewayRegistry,
  ) {}

  async execute(command: UpdatePayoutMethodCommand): Promise<void> {
    const tenantId = await this.userRepo.findTenantId(command.actorUserId)
    if (!tenantId) throw AppException.forbidden('tenant.not_a_tenant_member')

    const method = await this.repo.findById(command.methodId)
    if (!method || method.tenantId !== tenantId) {
      throw AppException.notFound('entities.payout_method', command.methodId)
    }

    if (command.phone !== undefined && command.phone !== null) {
      const gateway = this.registry.get(PAYPHONE_PROVIDER)
      const registered = await gateway.verifyReceiver(command.phone, gateway.platformCredentials())
      if (!registered) throw AppException.businessRule('payment.phone_not_registered')

      method.updateSplitReceiver(normalizeEcuadorPhone(command.phone))
      method.markVerified()
    }

    if (command.bank !== undefined && command.bank !== null) {
      method.updateBankDetails(command.bank)
    }

    if (command.isActive !== undefined) {
      command.isActive ? method.activate() : method.deactivate()
    }

    if (command.sortOrder !== undefined) {
      method.reorder(command.sortOrder)
    }

    await this.repo.save(method)
  }
}
