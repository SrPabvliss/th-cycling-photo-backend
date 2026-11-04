export class GetOrderTaxDocumentFilesQuery {
  constructor(
    public readonly orderId: string,
    public readonly taxDocumentId: string,
    public readonly userId: string,
    public readonly actor: 'admin' | 'buyer',
  ) {}
}
