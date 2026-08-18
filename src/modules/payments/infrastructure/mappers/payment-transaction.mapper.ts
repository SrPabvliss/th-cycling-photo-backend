import type { PaymentTransaction as PrismaPaymentTransaction } from '@generated/prisma/client'
import { Prisma } from '@generated/prisma/client'
import { PaymentTransaction } from '@payments/domain/entities'
import type { PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'
import type { PaymentTransactionStatusType } from '@payments/domain/value-objects/payment-transaction-status.vo'

export function toPersistence(
  entity: PaymentTransaction,
): Prisma.PaymentTransactionUncheckedCreateInput {
  return {
    id: entity.id,
    order_id: entity.orderId,
    client_transaction_id: entity.clientTransactionId,
    provider: entity.provider as Prisma.PaymentTransactionUncheckedCreateInput['provider'],
    gateway_transaction_id: entity.gatewayTransactionId,
    status: entity.status,
    amount_cents: entity.amountCents,
    amount_without_tax_cents: entity.amountWithoutTaxCents,
    amount_with_tax_cents: entity.amountWithTaxCents,
    tax_cents: entity.taxCents,
    commission_cents: entity.commissionCents,
    transfer_to_cents: entity.transferToCents,
    mode_snapshot: entity.modeSnapshot,
    receiver_snapshot: entity.receiverSnapshot,
    store_id_snapshot: entity.storeIdSnapshot,
    authorization_code: entity.authorizationCode,
    card_brand: entity.cardBrand,
    last_digits: entity.lastDigits,
    confirm_payload:
      entity.confirmPayload === null
        ? Prisma.DbNull
        : (entity.confirmPayload as unknown as Prisma.InputJsonValue),
    failure_message: entity.failureMessage,
    confirmed_at: entity.confirmedAt,
    created_at: entity.createdAt,
  }
}

export function toEntity(record: PrismaPaymentTransaction): PaymentTransaction {
  return PaymentTransaction.fromPersistence({
    id: record.id,
    orderId: record.order_id,
    clientTransactionId: record.client_transaction_id,
    provider: record.provider,
    gatewayTransactionId: record.gateway_transaction_id,
    status: record.status as PaymentTransactionStatusType,
    amountCents: record.amount_cents,
    amountWithoutTaxCents: record.amount_without_tax_cents,
    amountWithTaxCents: record.amount_with_tax_cents,
    taxCents: record.tax_cents,
    commissionCents: record.commission_cents,
    transferToCents: record.transfer_to_cents,
    modeSnapshot: record.mode_snapshot as PaymentModeType,
    receiverSnapshot: record.receiver_snapshot,
    storeIdSnapshot: record.store_id_snapshot,
    authorizationCode: record.authorization_code,
    cardBrand: record.card_brand,
    lastDigits: record.last_digits,
    confirmPayload: record.confirm_payload as Record<string, unknown> | null,
    failureMessage: record.failure_message,
    confirmedAt: record.confirmed_at,
    createdAt: record.created_at,
  })
}
