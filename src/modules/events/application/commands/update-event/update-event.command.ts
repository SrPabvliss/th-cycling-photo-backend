export class UpdateEventCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly date?: Date,
    public readonly location?: string | null,
  ) {}
}
