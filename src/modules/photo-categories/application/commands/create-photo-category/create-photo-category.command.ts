export class CreatePhotoCategoryCommand {
  constructor(
    public readonly name: string,
    public readonly userId: string,
    /** Creates a base category (platform only) instead of one of the caller's own. */
    public readonly base: boolean,
  ) {}
}
