import type { SellerPaymentAccount } from '../entities'

export interface ISellerPaymentAccountReadRepository {
  findByUserId(userId: string): Promise<SellerPaymentAccount | null>
}

export const SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY = Symbol(
  'SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY',
)
