import type { BillingAccount as BillingAccountRecord, Prisma } from '@generated/prisma/client'
import { BillingAccount } from '../../domain/entities/billing-account.entity'

export class BillingAccountMapper {
  static toPersistence(account: BillingAccount): Prisma.BillingAccountUncheckedCreateInput {
    return {
      id: account.id,
      user_id: account.userId,
      id_type: account.idType,
      id_number: account.idNumber,
      legal_name: account.legalName,
      email: account.email,
      address: account.address,
      is_default: account.isDefault,
      created_at: account.createdAt,
      deleted_at: account.deletedAt,
    }
  }

  static toEntity(record: BillingAccountRecord): BillingAccount {
    return BillingAccount.fromPersistence({
      id: record.id,
      userId: record.user_id,
      idType: record.id_type,
      idNumber: record.id_number,
      legalName: record.legal_name,
      email: record.email,
      address: record.address,
      isDefault: record.is_default,
      createdAt: record.created_at,
      deletedAt: record.deleted_at,
    })
  }
}
