import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type {
  CreateTenantPayload,
  ITenantRepository,
  TenantListProjection,
} from '../../domain/ports/tenant-repository.port'

@Injectable()
export class TenantRepository implements ITenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantsList(): Promise<TenantListProjection[]> {
    const tenants = await this.prisma.tenant.findMany({
      where: { is_platform: false },
      include: {
        _count: {
          select: {
            events: {
              where: { deleted_at: null },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      eventQuota: t.event_quota,
      eventsUsed: t._count.events,
      createdAt: t.created_at,
    }))
  }

  async updateEventQuota(tenantId: string, quota: number): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { event_quota: quota },
    })
  }

  async createTenantWithAdmin(data: CreateTenantPayload): Promise<string> {
    const tenant = await this.prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: data.name,
          event_quota: data.eventQuota,
          is_platform: false,
        },
      })

      await tx.user.create({
        data: {
          email: data.adminEmail,
          password_hash: data.adminPasswordHash,
          first_name: data.adminFirstName,
          last_name: data.adminLastName,
          tenant_id: newTenant.id,
          permission_template_id: data.tenantTemplateId,
        },
      })

      return newTenant
    })

    return tenant.id
  }

  async checkQuota(
    tenantId: string,
  ): Promise<{ quota: number; used: number; isPlatform: boolean }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            events: {
              where: { deleted_at: null },
            },
          },
        },
      },
    })

    if (!tenant) throw new Error('Tenant not found')

    return {
      quota: tenant.event_quota,
      used: tenant._count.events,
      isPlatform: tenant.is_platform,
    }
  }
}
