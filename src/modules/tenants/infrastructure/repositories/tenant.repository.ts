import { Injectable } from '@nestjs/common'
import { EVENT_SLOT_CONSUMED_FILTER } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import type { ITenantRepository } from '../../domain/ports/tenant-repository.port'

@Injectable()
export class TenantRepository implements ITenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async updateEventPhotoQuotaDefault(tenantId: string, quota: number | null): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { default_event_photo_quota: quota },
    })
  }

  async checkQuota(tenantId: string): Promise<{
    quota: number
    used: number
    isPlatform: boolean
    defaultEventPhotoQuota: number | null
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            events: {
              where: EVENT_SLOT_CONSUMED_FILTER,
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
      defaultEventPhotoQuota: tenant.default_event_photo_quota,
    }
  }
}
