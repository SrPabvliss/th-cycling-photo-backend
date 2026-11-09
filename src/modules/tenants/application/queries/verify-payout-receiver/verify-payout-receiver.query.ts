export class VerifyPayoutReceiverQuery {
  constructor(
    public readonly actorUserId: string,
    public readonly phone: string,
  ) {}
}
