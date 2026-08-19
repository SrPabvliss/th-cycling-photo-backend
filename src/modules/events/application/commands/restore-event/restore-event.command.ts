export class RestoreEventCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
