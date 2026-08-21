export class GenerateWatermarkPresignedUrlCommand {
  constructor(
    public readonly actorUserId: string,
    public readonly fileName: string,
    public readonly contentType: string,
  ) {}
}
