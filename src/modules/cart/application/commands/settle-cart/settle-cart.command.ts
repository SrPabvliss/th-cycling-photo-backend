export class SettleCartCommand {
  constructor(
    public readonly userId: string,
    public readonly orderIds: string[],
  ) {}
}
