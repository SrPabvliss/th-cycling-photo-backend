import type { Prisma, TenantPayoutMethod as PrismaTenantPayoutMethod } from '@generated/prisma/client'
import type { PaymentAccountStatusType } from '@payments/domain/value-objects/payment-account-status.vo'
import type { PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'
import { TenantPayoutMethod } from '../../domain/entities/tenant-payout-method.entity'
import type { PayoutProviderType } from '../../domain/value-objects/payout-provider.vo'

export function toPersistence(
  entity: TenantPayoutMethod,
): Prisma.TenantPayoutMethodUncheckedCreateInput {
  return {
    id: entity.id,
    tenant_id: entity.tenantId,
    provider: entity.provider as Prisma.TenantPayoutMethodUncheckedCreateInput['provider'],
    is_active: entity.isActive,
    sort_order: entity.sortOrder,
    mode: entity.mode,
    status: entity.status,
    receiver_identifier: entity.receiverIdentifier,
    credentials_encrypted: entity.credentialsEncrypted,
    verified_at: entity.verifiedAt,
    bank_name: entity.bankName,
    account_number: entity.accountNumber,
    account_type: entity.accountType,
    account_holder: entity.accountHolder,
    holder_identification: entity.holderIdentification,
    configured_by_id: entity.configuredById,
    created_at: entity.createdAt,
  }
}

export function toEntity(record: PrismaTenantPayoutMethod): TenantPayoutMethod {
  return TenantPayoutMethod.fromPersistence({
    id: record.id,
    tenantId: record.tenant_id,
    provider: record.provider as PayoutProviderType,
    isActive: record.is_active,
    sortOrder: record.sort_order,
    mode: record.mode as PaymentModeType | null,
    status: record.status as PaymentAccountStatusType,
    receiverIdentifier: record.receiver_identifier,
    credentialsEncrypted: record.credentials_encrypted,
    verifiedAt: record.verified_at,
    bankName: record.bank_name,
    accountNumber: record.account_number,
    accountType: record.account_type,
    accountHolder: record.account_holder,
    holderIdentification: record.holder_identification,
    configuredById: record.configured_by_id,
    createdAt: record.created_at,
  })
}
