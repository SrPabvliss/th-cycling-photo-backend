export class SnoozePromptCommand {
  constructor(
    public readonly userId: string,
    public readonly promptKey: string,
  ) {}
}
