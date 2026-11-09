export class SetEventFreezeCommand {
  constructor(
    public readonly id: string,
    public readonly frozen: boolean,
    public readonly userId: string,
  ) {}
}
