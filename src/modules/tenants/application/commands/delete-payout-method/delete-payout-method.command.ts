export class DeletePayoutMethodCommand {
  constructor(
    public readonly actorUserId: string,
    public readonly methodId: string,
  ) {}
}
