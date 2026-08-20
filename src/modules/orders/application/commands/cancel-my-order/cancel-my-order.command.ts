export class CancelMyOrderCommand {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
  ) {}
}
