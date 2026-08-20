import type { TenantPayoutMethod } from '../entities/tenant-payout-method.entity'

export const TENANT_PAYOUT_METHOD_REPOSITORY = Symbol('TENANT_PAYOUT_METHOD_REPOSITORY')

export interface ITenantPayoutMethodRepository {
  findByTenantId(tenantId: string): Promise<TenantPayoutMethod[]>
  findById(id: string): Promise<TenantPayoutMethod | null>
  findActivePayphoneForTenant(tenantId: string): Promise<TenantPayoutMethod | null>
  save(method: TenantPayoutMethod): Promise<void>
  delete(id: string): Promise<void>
}
