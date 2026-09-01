export class GeneratePresignedUrlCommand {
  constructor(
    public readonly eventId: string,
    public readonly fileName: string,
    public readonly contentType: string,
    public readonly userId: string,
    public readonly batchSize: number = 1,
  ) {}
}
