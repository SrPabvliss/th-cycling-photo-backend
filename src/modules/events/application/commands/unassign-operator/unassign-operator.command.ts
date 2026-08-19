export class UnassignOperatorCommand {
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly unassignedById: string,
  ) {}
}
