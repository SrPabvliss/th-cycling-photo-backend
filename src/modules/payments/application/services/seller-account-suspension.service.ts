import { Inject, Injectable, Logger } from '@nestjs/common'
import { AppException } from '@shared/domain'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '../../../tenants/domain/ports/tenant-payout-method-repository.port'

@Injectable()
export class SellerAccountSuspension {
  private readonly logger = new Logger(SellerAccountSuspension.name)

  constructor(
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: ITenantPayoutMethodRepository,
  ) {}

  async disableOnInvalidCredentials(
    error: unknown,
    sellerTenantId: string | null | undefined,
  ): Promise<void> {
    if (!(error instanceof AppException)) return
    if (error.messageKey !== 'payment.invalid_credentials') return
    if (!sellerTenantId) return

    const method = await this.payoutRepo.findActivePayphoneForTenant(sellerTenantId)
    if (!method) return

    method.deactivate()
    await this.payoutRepo.save(method)

    this.logger.error(
      `The gateway rejected the seller credentials; the payout method has been deactivated. sellerTenantId=${sellerTenantId}`,
    )
  }
}
