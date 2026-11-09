export class GetOrderDetailQuery {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
  ) {}
}
