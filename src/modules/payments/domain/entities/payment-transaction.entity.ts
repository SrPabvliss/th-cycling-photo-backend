import type { AuthorizationResult, PaymentAmounts } from '@shared/payment-gateways'
import type { PaymentModeType } from '../value-objects/payment-mode.vo'
import {
  PaymentTransactionStatus,
  type PaymentTransactionStatusType,
} from '../value-objects/payment-transaction-status.vo'

export class PaymentTransaction {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly provider: string,
    public readonly clientTransactionId: string,
    public gatewayTransactionId: string | null,
    public status: PaymentTransactionStatusType,
    public readonly amountCents: number,
    public readonly amountWithoutTaxCents: number,
    public readonly amountWithTaxCents: number,
    public readonly taxCents: number,
    public readonly commissionCents: number,
    public readonly transferToCents: number | null,
    public readonly modeSnapshot: PaymentModeType,
    public readonly receiverSnapshot: string,
    public readonly storeIdSnapshot: string | null,
    public authorizationCode: string | null,
    public cardBrand: string | null,
    public lastDigits: string | null,
    public confirmPayload: Record<string, unknown> | null,
    public failureMessage: string | null,
    public confirmedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  static start(input: {
    orderId: string
    provider: string
    clientTransactionId: string
    amounts: PaymentAmounts
    commissionCents: number
    mode: PaymentModeType
    receiver: string
    storeId: string | null
    transferToCents: number | null
  }): PaymentTransaction {
    return new PaymentTransaction(
      crypto.randomUUID(),
      input.orderId,
      input.provider,
      input.clientTransactionId,
      null,
      PaymentTransactionStatus.INITIATED,
      input.amounts.amountCents,
      input.amounts.amountWithoutTaxCents,
      input.amounts.amountWithTaxCents,
      input.amounts.taxCents,
      input.commissionCents,
      input.transferToCents,
      input.mode,
      input.receiver,
      input.storeId,
      null,
      null,
      null,
      null,
      null,
      null,
      new Date(),
    )
  }

  static fromPersistence(data: {
    id: string
    orderId: string
    provider: string
    clientTransactionId: string
    gatewayTransactionId: string | null
    status: PaymentTransactionStatusType
    amountCents: number
    amountWithoutTaxCents: number
    amountWithTaxCents: number
    taxCents: number
    commissionCents: number
    transferToCents: number | null
    modeSnapshot: PaymentModeType
    receiverSnapshot: string
    storeIdSnapshot: string | null
    authorizationCode: string | null
    cardBrand: string | null
    lastDigits: string | null
    confirmPayload: Record<string, unknown> | null
    failureMessage: string | null
    confirmedAt: Date | null
    createdAt: Date
  }): PaymentTransaction {
    return new PaymentTransaction(
      data.id,
      data.orderId,
      data.provider,
      data.clientTransactionId,
      data.gatewayTransactionId,
      data.status,
      data.amountCents,
      data.amountWithoutTaxCents,
      data.amountWithTaxCents,
      data.taxCents,
      data.commissionCents,
      data.transferToCents,
      data.modeSnapshot,
      data.receiverSnapshot,
      data.storeIdSnapshot,
      data.authorizationCode,
      data.cardBrand,
      data.lastDigits,
      data.confirmPayload,
      data.failureMessage,
      data.confirmedAt,
      data.createdAt,
    )
  }

  get isSettled(): boolean {
    return (
      this.status !== PaymentTransactionStatus.INITIATED &&
      this.status !== PaymentTransactionStatus.CONFIRMING
    )
  }

  beginConfirmation(): void {
    if (this.isSettled) return
    this.status = PaymentTransactionStatus.CONFIRMING
  }

  markApproved(result: AuthorizationResult): void {
    if (this.isSettled) return
    this.status = PaymentTransactionStatus.APPROVED
    this.gatewayTransactionId = result.gatewayTransactionId
    this.authorizationCode = result.authorizationCode
    this.cardBrand = result.cardBrand
    this.lastDigits = result.lastDigits
    this.confirmPayload = result.raw
    this.confirmedAt = new Date()
  }

  markDeclined(result: AuthorizationResult): void {
    if (this.isSettled) return
    this.status = PaymentTransactionStatus.DECLINED
    this.gatewayTransactionId = result.gatewayTransactionId
    this.failureMessage = result.message
    this.confirmPayload = result.raw
    this.confirmedAt = new Date()
  }

  markExpired(): void {
    if (this.isSettled) return
    this.status = PaymentTransactionStatus.EXPIRED
    this.confirmedAt = new Date()
  }
}
