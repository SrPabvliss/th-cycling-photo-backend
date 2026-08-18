export class CreatePaymentIntentCommand {
  constructor(
    public readonly orderIds: string[],
    public readonly buyerUserId: string,
  ) {}
}
