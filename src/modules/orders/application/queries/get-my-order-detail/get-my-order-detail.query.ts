export class GetMyOrderDetailQuery {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
  ) {}
}
