import type { BankTransferDetails } from '../../../domain/entities/tenant-payout-method.entity'
import type { PayoutProviderType } from '../../../domain/value-objects/payout-provider.vo'

export class CreatePayoutMethodCommand {
  constructor(
    public readonly actorUserId: string,
    public readonly provider: PayoutProviderType,
    public readonly phone: string | null,
    public readonly bank: BankTransferDetails | null,
  ) {}
}
