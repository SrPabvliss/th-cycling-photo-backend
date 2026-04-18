export class GeneratePresignedUrlCommand {
  constructor(
    public readonly eventId: string,
    public readonly fileName: string,
    public readonly contentType: string,
  ) {}
}
