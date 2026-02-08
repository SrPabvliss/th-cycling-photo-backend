export class CreateEventCommand {
  constructor(
    public readonly name: string,
    public readonly date: Date,
    public readonly location: string | null,
  ) {}
}
