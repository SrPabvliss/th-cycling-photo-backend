export class CreateOrderFromPreviewCommand {
  constructor(
    public readonly token: string,
    public readonly photoIds: string[],
    public readonly userId: string,
    public readonly notes: string | null,
    public readonly bibNumber: string | null,
    public readonly snapCategoryName: string | null,
  ) {}
}
