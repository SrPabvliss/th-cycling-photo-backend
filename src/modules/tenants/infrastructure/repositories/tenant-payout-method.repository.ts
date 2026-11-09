import { Injectable } from '@nestjs/common'
import { PaymentAccountStatus } from '@payments/domain/value-objects/payment-account-status.vo'
import { PrismaService } from '@shared/infrastructure'
import type { TenantPayoutMethod } from '../../domain/entities/tenant-payout-method.entity'
import type { ITenantPayoutMethodRepository } from '../../domain/ports/tenant-payout-method-repository.port'
import { PayoutProvider } from '../../domain/value-objects/payout-provider.vo'
import * as TenantPayoutMethodMapper from '../mappers/tenant-payout-method.mapper'

@Injectable()
export class TenantPayoutMethodRepository implements ITenantPayoutMethodRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantId(tenantId: string): Promise<TenantPayoutMethod[]> {
    const records = await this.prisma.tenantPayoutMethod.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    })
    return records.map(TenantPayoutMethodMapper.toEntity)
  }

  async findById(id: string): Promise<TenantPayoutMethod | null> {
    const record = await this.prisma.tenantPayoutMethod.findUnique({ where: { id } })
    return record ? TenantPayoutMethodMapper.toEntity(record) : null
  }

  async findActivePayphoneForTenant(tenantId: string): Promise<TenantPayoutMethod | null> {
    const record = await this.prisma.tenantPayoutMethod.findFirst({
      where: {
        tenant_id: tenantId,
        provider: PayoutProvider.PAYPHONE,
        is_active: true,
        status: PaymentAccountStatus.VERIFIED,
        mode: { not: null },
      },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    })
    return record ? TenantPayoutMethodMapper.toEntity(record) : null
  }

  async save(method: TenantPayoutMethod): Promise<void> {
    const data = TenantPayoutMethodMapper.toPersistence(method)
    await this.prisma.tenantPayoutMethod.upsert({
      where: { id: method.id },
      create: data,
      update: data,
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tenantPayoutMethod.delete({ where: { id } })
  }
}
