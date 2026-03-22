export class CreateDeliveryLinkCommand {
  constructor(
    public readonly orderId: string,
    public readonly expiresInDays: number = 7,
  ) {}
}
