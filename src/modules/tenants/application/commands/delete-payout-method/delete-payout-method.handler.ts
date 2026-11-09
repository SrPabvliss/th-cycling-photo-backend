import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '../../../domain/ports/tenant-payout-method-repository.port'
import { DeletePayoutMethodCommand } from './delete-payout-method.command'

@CommandHandler(DeletePayoutMethodCommand)
export class DeletePayoutMethodHandler implements ICommandHandler<DeletePayoutMethodCommand> {
  constructor(
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY) private readonly repo: ITenantPayoutMethodRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
  ) {}

  async execute(command: DeletePayoutMethodCommand): Promise<void> {
    const tenantId = await this.userRepo.findTenantId(command.actorUserId)
    if (!tenantId) throw AppException.forbidden('tenant.not_a_tenant_member')

    const method = await this.repo.findById(command.methodId)
    if (!method || method.tenantId !== tenantId) {
      throw AppException.notFound('entities.payout_method', command.methodId)
    }

    await this.repo.delete(command.methodId)
  }
}
