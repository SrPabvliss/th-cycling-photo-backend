import { EventPayoutMethod } from '@events/domain/entities'
import type { EventBrandSnapshot } from '@events/domain/value-objects/event-brand-snapshot.vo'
import { Inject, Injectable } from '@nestjs/common'
import { AppException } from '@shared/domain'
import type { TenantPayoutMethod } from '@tenants/domain/entities/tenant-payout-method.entity'
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

export interface ConfigurationSelection {
  publicName?: string | null
  watermarkStorageKey?: string | null
  whatsappNumber?: string | null
  payoutMethodIds?: string[]
}

export interface MaterialisedConfiguration {
  brand: EventBrandSnapshot
  payoutMethods: EventPayoutMethod[]
}

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

  async materialise(
    tenantId: string,
    eventId: string,
    selection?: ConfigurationSelection,
  ): Promise<MaterialisedConfiguration> {
    const [profile, methods] = await Promise.all([
      this.profileRepo.findByTenantId(tenantId),
      this.payoutRepo.findByTenantId(tenantId),
    ])

    const brand: EventBrandSnapshot = {
      publicName:
        selection?.publicName !== undefined ? selection.publicName : (profile?.publicName ?? null),
      watermarkStorageKey:
        selection?.watermarkStorageKey !== undefined
          ? selection.watermarkStorageKey
          : (profile?.watermarkStorageKey ?? null),
      whatsappNumber:
        selection?.whatsappNumber !== undefined
          ? selection.whatsappNumber
          : (profile?.whatsappNumber ?? null),
    }

    const chosen = this.resolveSelectedMethods(methods, selection?.payoutMethodIds)
    if (!chosen.some((method) => method.isActive)) {
      throw AppException.businessRule('event.payout_method_required')
    }

    return { brand, payoutMethods: chosen.map((m) => EventPayoutMethod.copyFrom(eventId, m)) }
  }

  private resolveSelectedMethods(
    available: TenantPayoutMethod[],
    selectedIds?: string[],
  ): TenantPayoutMethod[] {
    if (selectedIds === undefined) return available

    return selectedIds.map((id) => {
      const match = available.find((method) => method.id === id)
      if (!match) throw AppException.notFound('entities.payoutMethod', id)
      return match
    })
  }
}
