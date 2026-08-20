import type { TenantProfile } from '../entities/tenant-profile.entity'

export const TENANT_PROFILE_REPOSITORY = Symbol('TENANT_PROFILE_REPOSITORY')

export interface ITenantProfileRepository {
  findByTenantId(tenantId: string): Promise<TenantProfile | null>
  save(profile: TenantProfile): Promise<void>
}
