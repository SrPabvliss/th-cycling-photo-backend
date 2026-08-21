import { EventPayoutMethod } from '@events/domain/entities'
import type { Prisma, EventPayoutMethod as PrismaEventPayoutMethod } from '@generated/prisma/client'
import type { PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'
import type { PayoutProviderType } from '@tenants/domain/value-objects/payout-provider.vo'

export function toPersistence(
  entity: EventPayoutMethod,
): Prisma.EventPayoutMethodUncheckedCreateInput {
  return {
    id: entity.id,
    event_id: entity.eventId,
    provider: entity.provider,
    is_active: entity.isActive,
    sort_order: entity.sortOrder,
    mode: entity.mode,
    receiver_identifier: entity.receiverIdentifier,
    bank_name: entity.bankName,
    account_number: entity.accountNumber,
    account_type: entity.accountType,
    account_holder: entity.accountHolder,
    holder_identification: entity.holderIdentification,
    source_payout_method_id: entity.sourcePayoutMethodId,
  }
}

export function toEntity(record: PrismaEventPayoutMethod): EventPayoutMethod {
  return EventPayoutMethod.fromPersistence({
    id: record.id,
    eventId: record.event_id,
    provider: record.provider as PayoutProviderType,
    isActive: record.is_active,
    sortOrder: record.sort_order,
    mode: record.mode as PaymentModeType | null,
    receiverIdentifier: record.receiver_identifier,
    bankName: record.bank_name,
    accountNumber: record.account_number,
    accountType: record.account_type,
    accountHolder: record.account_holder,
    holderIdentification: record.holder_identification,
    sourcePayoutMethodId: record.source_payout_method_id,
  })
}
