import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../domain/ports/tenant-repository.port'
import { UpdateTenantPhotoQuotaDefaultCommand } from './update-tenant-photo-quota-default.command'

@CommandHandler(UpdateTenantPhotoQuotaDefaultCommand)
export class UpdateTenantPhotoQuotaDefaultHandler
  implements ICommandHandler<UpdateTenantPhotoQuotaDefaultCommand>
{
  constructor(@Inject(TENANT_REPOSITORY) private readonly repo: ITenantRepository) {}

  async execute(command: UpdateTenantPhotoQuotaDefaultCommand): Promise<void> {
    await this.repo.updateEventPhotoQuotaDefault(command.tenantId, command.quota)
  }
}
