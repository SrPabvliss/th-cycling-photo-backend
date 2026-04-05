export class RemoveFromCartCommand {
  constructor(
    public readonly photoId: string,
    public readonly userId: string | null,
    public readonly sessionId: string | null,
  ) {}
}
