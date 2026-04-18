export class MergeCartCommand {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
  ) {}
}
