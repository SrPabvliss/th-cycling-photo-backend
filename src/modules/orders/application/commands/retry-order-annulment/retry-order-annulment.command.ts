export class RetryOrderAnnulmentCommand {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
  ) {}
}
