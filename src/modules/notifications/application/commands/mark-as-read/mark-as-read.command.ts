export class MarkAsReadCommand {
  constructor(
    public readonly userId: string,
    public readonly notificationId: string,
  ) {}
}
