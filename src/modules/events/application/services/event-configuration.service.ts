import { Inject, Injectable } from '@nestjs/common'
import { AppException } from '@shared/domain'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '@tenants/domain/ports/tenant-payout-method-repository.port'
import {
  type ITenantProfileRepository,
  TENANT_PROFILE_REPOSITORY,
} from '@tenants/domain/ports/tenant-profile-repository.port'
import { PayoutProvider } from '@tenants/domain/value-objects/payout-provider.vo'

export type ConfigurationRequirement =
  | 'publicName'
  | 'watermark'
  | 'whatsapp'
  | 'payphone'
  | 'bankTransfer'

@Injectable()
export class EventConfigurationService {
  constructor(
    @Inject(TENANT_PROFILE_REPOSITORY)
    private readonly profileRepo: ITenantProfileRepository,
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: ITenantPayoutMethodRepository,
  ) {}

  async findMissingRequirements(tenantId: string): Promise<ConfigurationRequirement[]> {
    const [profile, methods] = await Promise.all([
      this.profileRepo.findByTenantId(tenantId),
      this.payoutRepo.findByTenantId(tenantId),
    ])

    const active = methods.filter((method) => method.isActive)
    const missing: ConfigurationRequirement[] = []

    if (!profile?.publicName) missing.push('publicName')
    if (!profile?.watermarkStorageKey) missing.push('watermark')
    if (!profile?.whatsappNumber) missing.push('whatsapp')
    if (!active.some((m) => m.provider === PayoutProvider.PAYPHONE)) missing.push('payphone')
    if (!active.some((m) => m.provider === PayoutProvider.BANK_TRANSFER)) {
      missing.push('bankTransfer')
    }

    return missing
  }

  async assertProfileComplete(tenantId: string): Promise<void> {
    const missing = await this.findMissingRequirements(tenantId)
    if (missing.length > 0) {
      throw AppException.businessRule('event.configuration_incomplete', false, {
        missing: missing.join(', '),
      })
    }
  }
}
