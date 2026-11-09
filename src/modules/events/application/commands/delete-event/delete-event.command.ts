export class DeleteEventCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
