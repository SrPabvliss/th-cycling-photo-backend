export class ResendOrderTaxDocumentCommand {
  constructor(
    public readonly orderId: string,
    public readonly taxDocumentId: string,
    public readonly userId: string,
  ) {}
}
