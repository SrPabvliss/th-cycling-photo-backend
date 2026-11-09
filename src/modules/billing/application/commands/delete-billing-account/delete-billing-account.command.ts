export class DeleteBillingAccountCommand {
  constructor(
    public readonly userId: string,
    public readonly billingAccountId: string,
  ) {}
}
