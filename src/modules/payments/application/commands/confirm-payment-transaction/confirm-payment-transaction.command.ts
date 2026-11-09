export class ConfirmPaymentTransactionCommand {
  constructor(
    public readonly clientTransactionId: string,
    public readonly gatewayTransactionId: string,
    public readonly buyerUserId: string,
  ) {}
}
