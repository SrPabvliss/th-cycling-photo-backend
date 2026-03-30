export class UnassignCategoryFromEventCommand {
  constructor(
    public readonly eventId: string,
    public readonly photoCategoryId: string,
  ) {}
}
