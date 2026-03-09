export class ConfirmRetouchedUploadCommand {
  constructor(
    public readonly photoId: string,
    public readonly objectKey: string,
    public readonly fileSize: number,
  ) {}
}
