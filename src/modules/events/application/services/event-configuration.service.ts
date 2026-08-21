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

export interface RematerialisedConfiguration {
  brand: EventBrandSnapshot
  /** `null` means the selection omitted `payoutMethodIds`: keep the event's existing copies. */
  payoutMethods: EventPayoutMethod[] | null
}

export interface EventConfigurationBasis {
  id: string
  tenantId: string
  snapPublicName: string | null
  snapWatermarkStorageKey: string | null
  snapWhatsappNumber: string | null
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

    return this.build(eventId, selection, methods, {
      publicName: profile?.publicName ?? null,
      watermarkStorageKey: profile?.watermarkStorageKey ?? null,
      whatsappNumber: profile?.whatsappNumber ?? null,
    })
  }

  /** Update path: omitted fields keep the event's frozen copy instead of re-syncing to the profile. */
  async rematerialise(
    event: EventConfigurationBasis,
    selection: ConfigurationSelection,
    existingMethods: EventPayoutMethod[],
  ): Promise<RematerialisedConfiguration> {
    if (selection.payoutMethodIds === undefined) {
      const brand = this.resolveBrand(selection, {
        publicName: event.snapPublicName,
        watermarkStorageKey: event.snapWatermarkStorageKey,
        whatsappNumber: event.snapWhatsappNumber,
      })
      if (!existingMethods.some((method) => method.isActive)) {
        throw AppException.businessRule('event.payout_method_required')
      }
      return { brand, payoutMethods: null }
    }

    const methods = await this.payoutRepo.findByTenantId(event.tenantId)

    return this.build(event.id, selection, methods, {
      publicName: event.snapPublicName,
      watermarkStorageKey: event.snapWatermarkStorageKey,
      whatsappNumber: event.snapWhatsappNumber,
    })
  }

  private build(
    eventId: string,
    selection: ConfigurationSelection | undefined,
    methods: TenantPayoutMethod[],
    fallback: EventBrandSnapshot,
  ): MaterialisedConfiguration {
    const brand = this.resolveBrand(selection, fallback)

    const chosen = this.resolveSelectedMethods(methods, selection?.payoutMethodIds)
    if (!chosen.some((method) => method.isActive)) {
      throw AppException.businessRule('event.payout_method_required')
    }

    return { brand, payoutMethods: chosen.map((m) => EventPayoutMethod.copyFrom(eventId, m)) }
  }

  private resolveBrand(
    selection: ConfigurationSelection | undefined,
    fallback: EventBrandSnapshot,
  ): EventBrandSnapshot {
    return {
      publicName: selection?.publicName !== undefined ? selection.publicName : fallback.publicName,
      watermarkStorageKey:
        selection?.watermarkStorageKey !== undefined
          ? selection.watermarkStorageKey
          : fallback.watermarkStorageKey,
      whatsappNumber:
        selection?.whatsappNumber !== undefined
          ? selection.whatsappNumber
          : fallback.whatsappNumber,
    }
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
