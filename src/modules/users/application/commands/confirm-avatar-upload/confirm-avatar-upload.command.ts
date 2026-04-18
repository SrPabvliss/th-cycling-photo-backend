export class ConfirmAvatarUploadCommand {
  constructor(
    public readonly userId: string,
    public readonly storageKey: string,
  ) {}
}
