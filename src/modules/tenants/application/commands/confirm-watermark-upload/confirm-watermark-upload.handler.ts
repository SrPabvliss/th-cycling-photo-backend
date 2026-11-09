import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IKvStorageAdapter, KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import { WatermarkNormalizer } from '@shared/images'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import {
  type ITenantProfileRepository,
  TENANT_PROFILE_REPOSITORY,
} from '../../../domain/ports/tenant-profile-repository.port'
import { ConfirmWatermarkUploadCommand } from './confirm-watermark-upload.command'

@CommandHandler(ConfirmWatermarkUploadCommand)
export class ConfirmWatermarkUploadHandler
  implements ICommandHandler<ConfirmWatermarkUploadCommand>
{
  private readonly logger = new Logger(ConfirmWatermarkUploadHandler.name)

  constructor(
    @Inject(TENANT_PROFILE_REPOSITORY) private readonly profileRepo: ITenantProfileRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(KV_STORAGE_ADAPTER) private readonly kv: IKvStorageAdapter,
    private readonly watermarkNormalizer: WatermarkNormalizer,
  ) {}

  async execute(command: ConfirmWatermarkUploadCommand): Promise<void> {
    const tenantId = await this.userRepo.findTenantId(command.actorUserId)
    if (!tenantId) throw AppException.forbidden('tenant.not_a_tenant_member')

    const escapedTenantId = tenantId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const allowedKey = new RegExp(`^tenants/${escapedTenantId}/watermark/[a-zA-Z0-9._-]+$`)
    if (!allowedKey.test(command.storageKey)) {
      throw AppException.businessRule('tenant.invalid_storage_key')
    }

    const profile = await this.profileRepo.findByTenantId(tenantId)
    if (!profile) throw AppException.notFound('entities.tenant', tenantId)

    await this.watermarkNormalizer.normalize(command.storageKey)

    profile.changeBrand(undefined, command.storageKey)
    await this.profileRepo.save(profile)

    await this.kv.write(`wm-tenant-${tenantId}`, command.storageKey).catch((err) => {
      this.logger.error(`Failed to publish watermark KV entry for tenant ${tenantId}`, err)
    })
  }
}
