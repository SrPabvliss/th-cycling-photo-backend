import { AppException } from '@shared/domain'
import {
  PaymentAccountStatus,
  type PaymentAccountStatusType,
} from '../value-objects/payment-account-status.vo'
import { PaymentMode, type PaymentModeType } from '../value-objects/payment-mode.vo'

export class SellerPaymentAccount {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public provider: string,
    public mode: PaymentModeType,
    public status: PaymentAccountStatusType,
    public receiverIdentifier: string | null,
    public credentialsEncrypted: string | null,
    public verifiedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  static createForSplit(
    userId: string,
    provider: string,
    receiverIdentifier: string,
  ): SellerPaymentAccount {
    return new SellerPaymentAccount(
      crypto.randomUUID(),
      userId,
      provider,
      PaymentMode.SPLIT_RECEIVER,
      PaymentAccountStatus.PENDING,
      receiverIdentifier,
      null,
      null,
      new Date(),
    )
  }

  static createForOwnMerchant(
    userId: string,
    provider: string,
    credentialsEncrypted: string,
  ): SellerPaymentAccount {
    return new SellerPaymentAccount(
      crypto.randomUUID(),
      userId,
      provider,
      PaymentMode.OWN_MERCHANT,
      PaymentAccountStatus.PENDING,
      null,
      credentialsEncrypted,
      null,
      new Date(),
    )
  }

  static fromPersistence(data: {
    id: string
    userId: string
    provider: string
    mode: PaymentModeType
    status: PaymentAccountStatusType
    receiverIdentifier: string | null
    credentialsEncrypted: string | null
    verifiedAt: Date | null
    createdAt: Date
  }): SellerPaymentAccount {
    if (data.mode === PaymentMode.SPLIT_RECEIVER && !data.receiverIdentifier) {
      throw AppException.internal('Split account persisted without a receiver identifier')
    }
    if (data.mode === PaymentMode.OWN_MERCHANT && !data.credentialsEncrypted) {
      throw AppException.internal('Merchant account persisted without credentials')
    }

    return new SellerPaymentAccount(
      data.id,
      data.userId,
      data.provider,
      data.mode,
      data.status,
      data.receiverIdentifier,
      data.credentialsEncrypted,
      data.verifiedAt,
      data.createdAt,
    )
  }

  get isUsable(): boolean {
    return this.status === PaymentAccountStatus.VERIFIED
  }

  markVerified(): void {
    if (this.status === PaymentAccountStatus.VERIFIED) return
    this.status = PaymentAccountStatus.VERIFIED
    this.verifiedAt = new Date()
  }

  disable(): void {
    this.status = PaymentAccountStatus.DISABLED
  }

  updateSplitReceiver(receiverIdentifier: string): void {
    this.mode = PaymentMode.SPLIT_RECEIVER
    this.receiverIdentifier = receiverIdentifier
    this.credentialsEncrypted = null
    this.resetVerification()
  }

  updateMerchantCredentials(credentialsEncrypted: string): void {
    this.mode = PaymentMode.OWN_MERCHANT
    this.credentialsEncrypted = credentialsEncrypted
    this.receiverIdentifier = null
    this.resetVerification()
  }

  private resetVerification(): void {
    this.status = PaymentAccountStatus.PENDING
    this.verifiedAt = null
  }
}
