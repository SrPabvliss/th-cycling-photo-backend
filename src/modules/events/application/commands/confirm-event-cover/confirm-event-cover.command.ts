export class ConfirmEventCoverCommand {
  constructor(
    public readonly eventId: string,
    public readonly storageKey: string,
  ) {}
}
