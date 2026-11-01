export class ProcessPhotoClassificationCommand {
  constructor(
    public readonly photoId: string,
    public readonly isFinalAttempt = true,
  ) {}
}
