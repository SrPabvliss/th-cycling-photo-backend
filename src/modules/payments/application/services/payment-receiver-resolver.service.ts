import {
  EVENT_PAYOUT_METHOD_REPOSITORY,
  EVENT_READ_REPOSITORY,
  type IEventPayoutMethodRepository,
  type IEventReadRepository,
} from '@events/domain/ports'
import { Inject, Injectable } from '@nestjs/common'
import { PaymentMode, type PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'
import { AppException } from '@shared/domain'
import type { PayoutProviderType } from '@tenants/domain/value-objects/payout-provider.vo'
import { PayoutProvider } from '@tenants/domain/value-objects/payout-provider.vo'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '../../../tenants/domain/ports/tenant-payout-method-repository.port'

export interface ReceiverAccount {
  provider: PayoutProviderType
  mode: PaymentModeType | null
  receiverIdentifier: string | null
  credentialsEncrypted: string | null
  isUsable: boolean
}

/**
 * The single place that decides which Payphone account collects a card payment for an event:
 * the event's own split-receiver Payphone when it has one, otherwise the seller tenant's active
 * verified Payphone. Checkout asks it whether to offer the card at all, and the payment intent
 * asks it which account to charge, so the two can never disagree.
 */
@Injectable()
export class PaymentReceiverResolver {
  constructor(
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: ITenantPayoutMethodRepository,
    @Inject(EVENT_PAYOUT_METHOD_REPOSITORY)
    private readonly eventPayoutRepo: IEventPayoutMethodRepository,
    @Inject(EVENT_READ_REPOSITORY)
    private readonly eventReadRepo: IEventReadRepository,
  ) {}

  async resolveForEvent(eventId: string, sellerTenantId: string): Promise<ReceiverAccount | null> {
    const eventOnly = await this.findEventOnlyPayphone(eventId)
    if (eventOnly) {
      if (!this.isEventOnlyUsable(eventOnly)) {
        throw AppException.businessRule('payment.account_not_verified')
      }
      return {
        provider: eventOnly.provider,
        mode: eventOnly.mode,
        receiverIdentifier: eventOnly.receiverIdentifier,
        credentialsEncrypted: null,
        isUsable: true,
      }
    }
    return this.payoutRepo.findActivePayphoneForTenant(sellerTenantId)
  }

  async acceptsCard(eventId: string): Promise<boolean> {
    const event = await this.eventReadRepo.findById(eventId)
    if (!event) return false

    const eventOnly = await this.findEventOnlyPayphone(eventId)
    if (eventOnly) return this.isEventOnlyUsable(eventOnly)

    const tenantAccount = await this.payoutRepo.findActivePayphoneForTenant(event.tenantId)
    return tenantAccount?.isUsable ?? false
  }

  private async findEventOnlyPayphone(eventId: string) {
    const methods = await this.eventPayoutRepo.findByEventId(eventId)
    const firstActivePayphone = methods.find(
      (method) => method.provider === PayoutProvider.PAYPHONE && method.isActive,
    )
    if (!firstActivePayphone || firstActivePayphone.sourcePayoutMethodId !== null) return null
    return firstActivePayphone
  }

  private isEventOnlyUsable(method: {
    mode: PaymentModeType | null
    receiverIdentifier: string | null
  }): boolean {
    return method.mode === PaymentMode.SPLIT_RECEIVER && Boolean(method.receiverIdentifier)
  }
}
