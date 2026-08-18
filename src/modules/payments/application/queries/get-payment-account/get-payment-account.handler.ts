import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PaymentAccountProjection } from '@payments/application/projections'
import {
  type ISellerPaymentAccountReadRepository,
  SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY,
} from '@payments/domain/ports'
import { CredentialCipher } from '@shared/crypto'
import { GetPaymentAccountQuery } from './get-payment-account.query'

@QueryHandler(GetPaymentAccountQuery)
export class GetPaymentAccountHandler implements IQueryHandler<GetPaymentAccountQuery> {
  constructor(
    @Inject(SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY)
    private readonly readRepo: ISellerPaymentAccountReadRepository,
    private readonly cipher: CredentialCipher,
  ) {}

  async execute(query: GetPaymentAccountQuery): Promise<PaymentAccountProjection | null> {
    const account = await this.readRepo.findByUserId(query.userId)
    if (!account) return null

    return {
      provider: account.provider,
      mode: account.mode,
      status: account.status,
      phone: account.receiverIdentifier,
      storeId: this.readStoreId(account.credentialsEncrypted),
      verifiedAt: account.verifiedAt,
      isUsable: account.isUsable,
    }
  }

  private readStoreId(credentialsEncrypted: string | null): string | null {
    if (!credentialsEncrypted) return null

    const credentials = JSON.parse(this.cipher.decrypt(credentialsEncrypted))

    return (credentials.storeId as string | null) ?? null
  }
}
