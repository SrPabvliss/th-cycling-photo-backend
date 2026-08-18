export class CreatePaymentIntentCommand {
  constructor(
    public readonly orderId: string,
    public readonly buyerUserId: string,
  ) {}
}
