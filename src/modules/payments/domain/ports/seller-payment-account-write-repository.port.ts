import type { SellerPaymentAccount } from '../entities'

export interface ISellerPaymentAccountWriteRepository {
  save(account: SellerPaymentAccount): Promise<SellerPaymentAccount>
}

export const SELLER_PAYMENT_ACCOUNT_WRITE_REPOSITORY = Symbol(
  'SELLER_PAYMENT_ACCOUNT_WRITE_REPOSITORY',
)
