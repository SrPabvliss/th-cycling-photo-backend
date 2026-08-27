import { PaymentMode, type PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'
import type { TenantPayoutMethod } from '@tenants/domain/entities/tenant-payout-method.entity'
import {
  PayoutProvider,
  type PayoutProviderType,
} from '@tenants/domain/value-objects/payout-provider.vo'

export interface EventBankTransferDetails {
  bankName: string
  accountNumber: string
  accountType: string
  accountHolder: string
  holderIdentification: string
}

export interface EventPayoutMethodState {
  id: string
  eventId: string
  provider: PayoutProviderType
  isActive: boolean
  sortOrder: number
  mode: PaymentModeType | null
  receiverIdentifier: string | null
  bankName: string | null
  accountNumber: string | null
  accountType: string | null
  accountHolder: string | null
  holderIdentification: string | null
  sourcePayoutMethodId: string | null
}

export class EventPayoutMethod {
  private constructor(private state: EventPayoutMethodState) {}

  static copyFrom(eventId: string, source: TenantPayoutMethod): EventPayoutMethod {
    return new EventPayoutMethod({
      id: crypto.randomUUID(),
      eventId,
      provider: source.provider,
      isActive: source.isActive,
      sortOrder: source.sortOrder,
      mode: source.mode,
      receiverIdentifier: source.receiverIdentifier,
      bankName: source.bankName,
      accountNumber: source.accountNumber,
      accountType: source.accountType,
      accountHolder: source.accountHolder,
      holderIdentification: source.holderIdentification,
      sourcePayoutMethodId: source.id,
    })
  }

  static fromPersistence(state: EventPayoutMethodState): EventPayoutMethod {
    return new EventPayoutMethod(state)
  }

  static createPayphoneSplit(eventId: string, receiverIdentifier: string): EventPayoutMethod {
    return new EventPayoutMethod({
      id: crypto.randomUUID(),
      eventId,
      provider: PayoutProvider.PAYPHONE,
      isActive: true,
      sortOrder: 0,
      mode: PaymentMode.SPLIT_RECEIVER,
      receiverIdentifier,
      bankName: null,
      accountNumber: null,
      accountType: null,
      accountHolder: null,
      holderIdentification: null,
      sourcePayoutMethodId: null,
    })
  }

  static createBankTransfer(eventId: string, details: EventBankTransferDetails): EventPayoutMethod {
    return new EventPayoutMethod({
      id: crypto.randomUUID(),
      eventId,
      provider: PayoutProvider.BANK_TRANSFER,
      isActive: true,
      sortOrder: 0,
      mode: null,
      receiverIdentifier: null,
      bankName: details.bankName,
      accountNumber: details.accountNumber,
      accountType: details.accountType,
      accountHolder: details.accountHolder,
      holderIdentification: details.holderIdentification,
      sourcePayoutMethodId: null,
    })
  }

  get id(): string {
    return this.state.id
  }
  get eventId(): string {
    return this.state.eventId
  }
  get provider(): PayoutProviderType {
    return this.state.provider
  }
  get isActive(): boolean {
    return this.state.isActive
  }
  get sortOrder(): number {
    return this.state.sortOrder
  }
  get mode(): PaymentModeType | null {
    return this.state.mode
  }
  get receiverIdentifier(): string | null {
    return this.state.receiverIdentifier
  }
  get bankName(): string | null {
    return this.state.bankName
  }
  get accountNumber(): string | null {
    return this.state.accountNumber
  }
  get accountType(): string | null {
    return this.state.accountType
  }
  get accountHolder(): string | null {
    return this.state.accountHolder
  }
  get holderIdentification(): string | null {
    return this.state.holderIdentification
  }
  get sourcePayoutMethodId(): string | null {
    return this.state.sourcePayoutMethodId
  }

  setActive(isActive: boolean): void {
    this.state.isActive = isActive
  }

  reorder(sortOrder: number): void {
    this.state.sortOrder = sortOrder
  }
}
