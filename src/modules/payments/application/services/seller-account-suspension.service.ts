import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  type ISellerPaymentAccountReadRepository,
  type ISellerPaymentAccountWriteRepository,
  SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY,
  SELLER_PAYMENT_ACCOUNT_WRITE_REPOSITORY,
} from '@payments/domain/ports'
import { AppException } from '@shared/domain'

@Injectable()
export class SellerAccountSuspension {
  private readonly logger = new Logger(SellerAccountSuspension.name)

  constructor(
    @Inject(SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY)
    private readonly accountRepo: ISellerPaymentAccountReadRepository,
    @Inject(SELLER_PAYMENT_ACCOUNT_WRITE_REPOSITORY)
    private readonly accountWriteRepo: ISellerPaymentAccountWriteRepository,
  ) {}

  async disableOnInvalidCredentials(
    error: unknown,
    sellerUserId: string | null | undefined,
  ): Promise<void> {
    if (!(error instanceof AppException)) return
    if (error.messageKey !== 'payment.invalid_credentials') return
    if (!sellerUserId) return

    const account = await this.accountRepo.findByUserId(sellerUserId)
    if (!account) return

    account.disable()
    await this.accountWriteRepo.save(account)

    this.logger.error(
      `The gateway rejected the seller credentials; the account has been disabled. sellerUserId=${sellerUserId}`,
    )
  }
}
