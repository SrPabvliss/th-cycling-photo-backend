import type { BankTransferDetails } from '../../../domain/entities/tenant-payout-method.entity'

export class UpdatePayoutMethodCommand {
  constructor(
    public readonly actorUserId: string,
    public readonly methodId: string,
    public readonly phone: string | null | undefined,
    public readonly bank: BankTransferDetails | null | undefined,
    public readonly isActive: boolean | undefined,
    public readonly sortOrder: number | undefined,
  ) {}
}
