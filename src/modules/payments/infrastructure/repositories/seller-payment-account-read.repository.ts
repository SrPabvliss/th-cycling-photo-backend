import { Injectable } from '@nestjs/common'
import type { SellerPaymentAccount } from '@payments/domain/entities'
import type { ISellerPaymentAccountReadRepository } from '@payments/domain/ports'
import { PrismaService } from '@shared/infrastructure'
import * as SellerPaymentAccountMapper from '../mappers/seller-payment-account.mapper'

@Injectable()
export class SellerPaymentAccountReadRepository implements ISellerPaymentAccountReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<SellerPaymentAccount | null> {
    const record = await this.prisma.sellerPaymentAccount.findUnique({ where: { user_id: userId } })
    return record ? SellerPaymentAccountMapper.toEntity(record) : null
  }
}
