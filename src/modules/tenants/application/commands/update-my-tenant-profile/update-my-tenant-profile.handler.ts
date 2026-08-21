import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import {
  type ITenantProfileRepository,
  TENANT_PROFILE_REPOSITORY,
} from '../../../domain/ports/tenant-profile-repository.port'
import { UpdateMyTenantProfileCommand } from './update-my-tenant-profile.command'

@CommandHandler(UpdateMyTenantProfileCommand)
export class UpdateMyTenantProfileHandler implements ICommandHandler<UpdateMyTenantProfileCommand> {
  constructor(
    @Inject(TENANT_PROFILE_REPOSITORY) private readonly repo: ITenantProfileRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
  ) {}

  async execute(command: UpdateMyTenantProfileCommand): Promise<void> {
    const tenantId = await this.userRepo.findTenantId(command.actorUserId)
    if (!tenantId) throw AppException.forbidden('tenant.not_a_tenant_member')

    const profile = await this.repo.findByTenantId(tenantId)
    if (!profile) throw AppException.notFound('entities.tenant', tenantId)

    profile.changeBrand(command.publicName, command.watermarkStorageKey)
    profile.changeWhatsapp(command.whatsappNumber)

    await this.repo.save(profile)
  }
}
