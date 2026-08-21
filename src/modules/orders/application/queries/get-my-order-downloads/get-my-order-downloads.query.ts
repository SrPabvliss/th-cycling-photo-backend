export class GetMyOrderDownloadsQuery {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
  ) {}
}
