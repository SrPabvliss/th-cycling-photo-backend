import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import { TenantProfile } from '../../domain/entities/tenant-profile.entity'
import type { ITenantProfileRepository } from '../../domain/ports/tenant-profile-repository.port'

@Injectable()
export class TenantProfileRepository implements ITenantProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantId(tenantId: string): Promise<TenantProfile | null> {
    const record = await this.prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!record) return null

    return TenantProfile.fromPersistence({
      id: record.id,
      name: record.name,
      publicName: record.public_name,
      watermarkStorageKey: record.watermark_storage_key,
      whatsappNumber: record.whatsapp_number,
      whatsappVerifiedAt: record.whatsapp_verified_at,
    })
  }

  async save(profile: TenantProfile): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: profile.id },
      data: {
        public_name: profile.publicName,
        watermark_storage_key: profile.watermarkStorageKey,
        whatsapp_number: profile.whatsappNumber,
        whatsapp_verified_at: profile.whatsappVerifiedAt,
      },
    })
  }
}
