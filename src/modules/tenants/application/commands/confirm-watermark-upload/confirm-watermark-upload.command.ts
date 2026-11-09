export class ConfirmWatermarkUploadCommand {
  constructor(
    public readonly actorUserId: string,
    public readonly storageKey: string,
  ) {}
}
