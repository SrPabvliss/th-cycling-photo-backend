import type { AuditContext } from '@shared/application'

export class ChangeOrderContactPhoneCommand {
  constructor(
    public readonly orderId: string,
    public readonly phoneNumber: string,
    /** The buyer's account takes the number too, as its primary one. */
    public readonly updateAccount: boolean,
    public readonly audit: AuditContext,
  ) {}
}
