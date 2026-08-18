import { Injectable } from '@nestjs/common'
import type { SellerPaymentAccount } from '@payments/domain/entities'
import type { ISellerPaymentAccountWriteRepository } from '@payments/domain/ports'
import { PrismaService } from '@shared/infrastructure'
import * as SellerPaymentAccountMapper from '../mappers/seller-payment-account.mapper'

@Injectable()
export class SellerPaymentAccountWriteRepository implements ISellerPaymentAccountWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(account: SellerPaymentAccount): Promise<SellerPaymentAccount> {
    const data = SellerPaymentAccountMapper.toPersistence(account)

    const saved = await this.prisma.sellerPaymentAccount.upsert({
      where: { id: account.id },
      create: data,
      update: data,
    })

    return SellerPaymentAccountMapper.toEntity(saved)
  }
}
