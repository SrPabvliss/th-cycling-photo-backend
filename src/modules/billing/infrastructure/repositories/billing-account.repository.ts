import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { BillingAccount } from '../../domain/entities/billing-account.entity'
import type { IBillingAccountRepository } from '../../domain/ports'
import { BillingAccountMapper } from '../mappers/billing-account.mapper'

@Injectable()
export class BillingAccountRepository implements IBillingAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByUser(userId: string): Promise<BillingAccount[]> {
    const records = await this.prisma.billingAccount.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    })
    return records.map(BillingAccountMapper.toEntity)
  }

  async findActiveById(id: string, userId: string): Promise<BillingAccount | null> {
    const record = await this.prisma.billingAccount.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    })
    return record ? BillingAccountMapper.toEntity(record) : null
  }

  async save(account: BillingAccount): Promise<void> {
    const data = BillingAccountMapper.toPersistence(account)
    await this.prisma.billingAccount.upsert({
      where: { id: account.id },
      create: data,
      update: data,
    })
  }

  async makeDefault(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.billingAccount.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false },
      })
      await tx.billingAccount.updateMany({
        where: { id, user_id: userId, deleted_at: null },
        data: { is_default: true },
      })
    })
  }
}
