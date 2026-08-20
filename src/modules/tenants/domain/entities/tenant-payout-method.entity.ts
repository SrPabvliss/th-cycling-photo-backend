import {
  PaymentAccountStatus,
  type PaymentAccountStatusType,
} from '@payments/domain/value-objects/payment-account-status.vo'
import { PaymentMode, type PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'
import { AppException } from '@shared/domain'
import { PayoutProvider, type PayoutProviderType } from '../value-objects/payout-provider.vo'

export interface BankTransferDetails {
  bankName: string
  accountNumber: string
  accountType: string
  accountHolder: string
  holderIdentification: string
}

interface TenantPayoutMethodState {
  id: string
  tenantId: string
  provider: PayoutProviderType
  isActive: boolean
  sortOrder: number
  mode: PaymentModeType | null
  status: PaymentAccountStatusType
  receiverIdentifier: string | null
  credentialsEncrypted: string | null
  verifiedAt: Date | null
  bankName: string | null
  accountNumber: string | null
  accountType: string | null
  accountHolder: string | null
  holderIdentification: string | null
  configuredById: string | null
  createdAt: Date
}

export class TenantPayoutMethod {
  private constructor(private state: TenantPayoutMethodState) {}

  static createPayphoneSplit(
    tenantId: string,
    receiverIdentifier: string,
    configuredById: string | null,
  ): TenantPayoutMethod {
    return new TenantPayoutMethod({
      id: crypto.randomUUID(),
      tenantId,
      provider: PayoutProvider.PAYPHONE,
      isActive: true,
      sortOrder: 0,
      mode: PaymentMode.SPLIT_RECEIVER,
      status: PaymentAccountStatus.PENDING,
      receiverIdentifier,
      credentialsEncrypted: null,
      verifiedAt: null,
      bankName: null,
      accountNumber: null,
      accountType: null,
      accountHolder: null,
      holderIdentification: null,
      configuredById,
      createdAt: new Date(),
    })
  }

  static createBankTransfer(
    tenantId: string,
    bank: BankTransferDetails,
    configuredById: string | null,
  ): TenantPayoutMethod {
    return new TenantPayoutMethod({
      id: crypto.randomUUID(),
      tenantId,
      provider: PayoutProvider.BANK_TRANSFER,
      isActive: true,
      sortOrder: 0,
      mode: null,
      status: PaymentAccountStatus.VERIFIED,
      receiverIdentifier: null,
      credentialsEncrypted: null,
      verifiedAt: new Date(),
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      accountType: bank.accountType,
      accountHolder: bank.accountHolder,
      holderIdentification: bank.holderIdentification,
      configuredById,
      createdAt: new Date(),
    })
  }

  static fromPersistence(state: TenantPayoutMethodState): TenantPayoutMethod {
    if (state.provider === PayoutProvider.PAYPHONE && !state.receiverIdentifier) {
      throw AppException.internal('Payphone payout method persisted without a receiver identifier')
    }
    if (
      state.provider === PayoutProvider.BANK_TRANSFER &&
      (!state.accountNumber || !state.accountHolder)
    ) {
      throw AppException.internal('Bank transfer payout method persisted without account details')
    }
    return new TenantPayoutMethod(state)
  }

  get id(): string { return this.state.id }
  get tenantId(): string { return this.state.tenantId }
  get provider(): PayoutProviderType { return this.state.provider }
  get isActive(): boolean { return this.state.isActive }
  get sortOrder(): number { return this.state.sortOrder }
  get mode(): PaymentModeType | null { return this.state.mode }
  get status(): PaymentAccountStatusType { return this.state.status }
  get receiverIdentifier(): string | null { return this.state.receiverIdentifier }
  get credentialsEncrypted(): string | null { return this.state.credentialsEncrypted }
  get verifiedAt(): Date | null { return this.state.verifiedAt }
  get bankName(): string | null { return this.state.bankName }
  get accountNumber(): string | null { return this.state.accountNumber }
  get accountType(): string | null { return this.state.accountType }
  get accountHolder(): string | null { return this.state.accountHolder }
  get holderIdentification(): string | null { return this.state.holderIdentification }
  get configuredById(): string | null { return this.state.configuredById }
  get createdAt(): Date { return this.state.createdAt }

  get isUsable(): boolean {
    return this.state.isActive && this.state.status === PaymentAccountStatus.VERIFIED
  }

  updateSplitReceiver(receiverIdentifier: string): void {
    this.state.receiverIdentifier = receiverIdentifier
    this.state.status = PaymentAccountStatus.PENDING
    this.state.verifiedAt = null
  }

  updateBankDetails(bank: BankTransferDetails): void {
    this.state.bankName = bank.bankName
    this.state.accountNumber = bank.accountNumber
    this.state.accountType = bank.accountType
    this.state.accountHolder = bank.accountHolder
    this.state.holderIdentification = bank.holderIdentification
  }

  markVerified(): void {
    if (this.state.status === PaymentAccountStatus.VERIFIED) return
    this.state.status = PaymentAccountStatus.VERIFIED
    this.state.verifiedAt = new Date()
  }

  deactivate(): void {
    this.state.isActive = false
  }

  reorder(sortOrder: number): void {
    this.state.sortOrder = sortOrder
  }
}
