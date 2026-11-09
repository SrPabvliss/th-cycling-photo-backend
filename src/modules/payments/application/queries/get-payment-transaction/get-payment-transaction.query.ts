export class GetPaymentTransactionQuery {
  constructor(
    public readonly clientTransactionId: string,
    public readonly buyerUserId: string,
  ) {}
}
