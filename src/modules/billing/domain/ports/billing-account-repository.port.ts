import type { BillingAccount } from '../entities/billing-account.entity'

export interface IBillingAccountRepository {
  findActiveByUser(userId: string): Promise<BillingAccount[]>
  findActiveById(id: string, userId: string): Promise<BillingAccount | null>
  save(account: BillingAccount): Promise<void>
  makeDefault(userId: string, id: string): Promise<void>
}

export const BILLING_ACCOUNT_REPOSITORY = Symbol('BILLING_ACCOUNT_REPOSITORY')
