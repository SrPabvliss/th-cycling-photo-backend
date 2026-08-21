export class AssignCategoryToEventCommand {
  constructor(
    public readonly eventId: string,
    public readonly photoCategoryId: number,
    public readonly assignedById: string,
  ) {}
}
