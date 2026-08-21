export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY')

export interface TenantListProjection {
  id: string
  name: string
  eventQuota: number
  eventsUsed: number
  createdAt: Date
}

export interface CreateTenantPayload {
  name: string
  eventQuota: number
  adminEmail: string
  adminPasswordHash: string
  adminFirstName: string
  adminLastName: string
  tenantTemplateId: string
}

export interface ITenantRepository {
  getTenantsList(): Promise<TenantListProjection[]>
  updateEventQuota(tenantId: string, quota: number): Promise<void>
  createTenantWithAdmin(data: CreateTenantPayload): Promise<string>
  checkQuota(tenantId: string): Promise<{ quota: number; used: number; isPlatform: boolean }>
}
