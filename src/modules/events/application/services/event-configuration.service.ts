import { EventPayoutMethod } from '@events/domain/entities'
import type { EventBrandSnapshot } from '@events/domain/value-objects/event-brand-snapshot.vo'
import { Inject, Injectable } from '@nestjs/common'
import { AppException } from '@shared/domain'
import { WatermarkNormalizer } from '@shared/images'
import {
  normalizeEcuadorPhone,
  PAYMENT_GATEWAY_REGISTRY,
  PAYPHONE_PROVIDER,
  type PaymentGatewayRegistry,
} from '@shared/payment-gateways'
import { isSafeStorageKey } from '@shared/storage/domain/storage-key'
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

export type EventPayoutSelection =
  | { source: 'profile'; id: string }
  | { source: 'event'; id: string }
  | { source: 'new'; provider: 'payphone'; phone: string }
  | {
      source: 'new'
      provider: 'bank_transfer'
      bankName: string
      accountNumber: string
      accountType: string
      accountHolder: string
      holderIdentification: string
    }

export interface ConfigurationSelection {
  publicName?: string | null
  watermarkStorageKey?: string | null
  whatsappNumber?: string | null
  payoutMethods?: EventPayoutSelection[]
}

export interface MaterialisedConfiguration {
  brand: EventBrandSnapshot
  payoutMethods: EventPayoutMethod[]
}

export interface RematerialisedConfiguration {
  brand: EventBrandSnapshot
  /** `null` means the selection omitted `payoutMethods`: keep the event's existing copies. */
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
    @Inject(PAYMENT_GATEWAY_REGISTRY)
    private readonly registry: PaymentGatewayRegistry,
    private readonly watermarkNormalizer: WatermarkNormalizer,
  ) {}

  /**
   * A watermark the organiser uploads for this event alone never passes through the profile, so
   * this is the only place its margin can be fixed before the gallery starts drawing it.
   */
  private async giveWatermarkRoom(selection?: ConfigurationSelection): Promise<void> {
    if (selection?.watermarkStorageKey) {
      await this.watermarkNormalizer.normalize(selection.watermarkStorageKey)
    }
  }

  async verifyNewPayphones(payoutMethods?: EventPayoutSelection[]): Promise<void> {
    const newPayphones = (payoutMethods ?? []).filter(
      (entry) => entry.source === 'new' && entry.provider === PayoutProvider.PAYPHONE,
    )
    if (newPayphones.length === 0) return

    const gateway = this.registry.get(PAYPHONE_PROVIDER)

    await Promise.all(
      newPayphones.map(async (entry) => {
        const registered = await gateway.verifyReceiver(entry.phone, gateway.platformCredentials())
        if (!registered) {
          throw AppException.businessRule('payment.phone_not_registered', false, {
            rule: 'phone_not_registered',
          })
        }
      }),
    )
  }

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

  assertConfigurationComplete(config: MaterialisedConfiguration): void {
    const active = config.payoutMethods.filter((method) => method.isActive)
    const missing: ConfigurationRequirement[] = []

    if (!config.brand.publicName) missing.push('publicName')
    if (!config.brand.watermarkStorageKey) missing.push('watermark')
    if (!config.brand.whatsappNumber) missing.push('whatsapp')
    if (!active.some((m) => m.provider === PayoutProvider.PAYPHONE)) missing.push('payphone')
    if (!active.some((m) => m.provider === PayoutProvider.BANK_TRANSFER)) {
      missing.push('bankTransfer')
    }

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

    this.assertWatermarkOwned(selection, tenantId)
    await this.giveWatermarkRoom(selection)

    return this.build(eventId, selection, methods, [], {
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
    if (selection.watermarkStorageKey !== undefined) {
      this.assertWatermarkOwned(selection, event.tenantId)
      await this.giveWatermarkRoom(selection)
    }

    if (selection.payoutMethods === undefined) {
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

    return this.build(event.id, selection, methods, existingMethods, {
      publicName: event.snapPublicName,
      watermarkStorageKey: event.snapWatermarkStorageKey,
      whatsappNumber: event.snapWhatsappNumber,
    })
  }

  private build(
    eventId: string,
    selection: ConfigurationSelection | undefined,
    methods: TenantPayoutMethod[],
    existing: EventPayoutMethod[],
    fallback: EventBrandSnapshot,
  ): MaterialisedConfiguration {
    const brand = this.resolveBrand(selection, fallback)

    const payoutMethods = this.resolvePayoutMethods(
      eventId,
      methods,
      existing,
      selection?.payoutMethods,
    )
    if (!payoutMethods.some((method) => method.isActive)) {
      throw AppException.businessRule('event.payout_method_required')
    }

    return { brand, payoutMethods }
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

  private assertWatermarkOwned(
    selection: ConfigurationSelection | undefined,
    tenantId: string,
  ): void {
    if (selection?.watermarkStorageKey === undefined) return
    if (selection.watermarkStorageKey === null) return

    const key = selection.watermarkStorageKey
    const prefix = `tenants/${tenantId}/watermark/`
    if (!key.startsWith(prefix) || !isSafeStorageKey(key)) {
      throw AppException.businessRule('event.watermark_not_owned')
    }
  }

  private resolvePayoutMethods(
    eventId: string,
    available: TenantPayoutMethod[],
    existing: EventPayoutMethod[],
    selection?: EventPayoutSelection[],
  ): EventPayoutMethod[] {
    if (selection === undefined) {
      return available.map((method, index) => {
        const copy = EventPayoutMethod.copyFrom(eventId, method)
        copy.reorder(index)
        return copy
      })
    }

    return selection.map((entry, index) => {
      const method = this.buildOne(eventId, available, existing, entry)
      method.reorder(index)
      return method
    })
  }

  private buildOne(
    eventId: string,
    available: TenantPayoutMethod[],
    existing: EventPayoutMethod[],
    entry: EventPayoutSelection,
  ): EventPayoutMethod {
    if (entry.source === 'event') {
      const kept = existing.find((method) => method.id === entry.id)
      if (!kept) throw AppException.notFound('entities.payoutMethod', entry.id)
      return kept
    }

    if (entry.source === 'profile') {
      const match = available.find((method) => method.id === entry.id)
      if (!match) throw AppException.notFound('entities.payoutMethod', entry.id)
      return EventPayoutMethod.copyFrom(eventId, match)
    }

    return entry.provider === PayoutProvider.PAYPHONE
      ? EventPayoutMethod.createPayphoneSplit(eventId, normalizeEcuadorPhone(entry.phone))
      : EventPayoutMethod.createBankTransfer(eventId, {
          bankName: entry.bankName,
          accountNumber: entry.accountNumber,
          accountType: entry.accountType,
          accountHolder: entry.accountHolder,
          holderIdentification: entry.holderIdentification,
        })
  }
}
