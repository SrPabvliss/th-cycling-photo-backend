export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY')

export interface ITenantRepository {
  updateEventPhotoQuotaDefault(tenantId: string, quota: number | null): Promise<void>
  checkQuota(tenantId: string): Promise<{
    quota: number
    used: number
    isPlatform: boolean
    defaultEventPhotoQuota: number | null
  }>
}
