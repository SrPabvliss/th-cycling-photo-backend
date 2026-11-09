export class GenerateRetouchedPresignedUrlCommand {
  constructor(
    public readonly photoId: string,
    public readonly fileName: string,
    public readonly contentType: string,
    public readonly userId: string,
  ) {}
}
