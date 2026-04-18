export class AssignOperatorCommand {
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly assignedById: string,
  ) {}
}
