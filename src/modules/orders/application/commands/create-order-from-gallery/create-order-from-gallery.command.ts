export class CreateOrderFromGalleryCommand {
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly photoIds: string[],
    public readonly bibNumber: string | null,
    public readonly snapCategoryName: string | null,
  ) {}
}
