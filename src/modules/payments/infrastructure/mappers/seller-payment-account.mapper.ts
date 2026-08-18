import type {
  Prisma,
  SellerPaymentAccount as PrismaSellerPaymentAccount,
} from '@generated/prisma/client'
import { SellerPaymentAccount } from '@payments/domain/entities'
import type { PaymentAccountStatusType } from '@payments/domain/value-objects/payment-account-status.vo'
import type { PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'

export function toPersistence(
  entity: SellerPaymentAccount,
): Prisma.SellerPaymentAccountUncheckedCreateInput {
  return {
    id: entity.id,
    user_id: entity.userId,
    provider: entity.provider as Prisma.SellerPaymentAccountUncheckedCreateInput['provider'],
    mode: entity.mode,
    status: entity.status,
    receiver_identifier: entity.receiverIdentifier,
    credentials_encrypted: entity.credentialsEncrypted,
    verified_at: entity.verifiedAt,
    created_at: entity.createdAt,
  }
}

export function toEntity(record: PrismaSellerPaymentAccount): SellerPaymentAccount {
  return SellerPaymentAccount.fromPersistence({
    id: record.id,
    userId: record.user_id,
    provider: record.provider,
    mode: record.mode as PaymentModeType,
    status: record.status as PaymentAccountStatusType,
    receiverIdentifier: record.receiver_identifier,
    credentialsEncrypted: record.credentials_encrypted,
    verifiedAt: record.verified_at,
    createdAt: record.created_at,
  })
}
