import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { TENANT_REPOSITORY, type ITenantRepository } from '../../../domain/ports/tenant-repository.port'
import { UpdateTenantQuotaCommand } from './update-tenant-quota.command'

@CommandHandler(UpdateTenantQuotaCommand)
export class UpdateTenantQuotaHandler implements ICommandHandler<UpdateTenantQuotaCommand> {
  constructor(@Inject(TENANT_REPOSITORY) private readonly repo: ITenantRepository) {}

  async execute(command: UpdateTenantQuotaCommand): Promise<void> {
    await this.repo.updateEventQuota(command.tenantId, command.quota)
  }
}
