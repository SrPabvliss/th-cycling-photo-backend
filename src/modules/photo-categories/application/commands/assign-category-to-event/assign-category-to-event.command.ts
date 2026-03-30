export class AssignCategoryToEventCommand {
  constructor(
    public readonly eventId: string,
    public readonly photoCategoryId: string,
  ) {}
}
