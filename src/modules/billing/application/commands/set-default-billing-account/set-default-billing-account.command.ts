export class SetDefaultBillingAccountCommand {
  constructor(
    public readonly userId: string,
    public readonly billingAccountId: string,
  ) {}
}
