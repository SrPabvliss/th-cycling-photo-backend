export class MarkPhotoReviewedCommand {
  constructor(
    public readonly photoId: string,
    public readonly reviewerId: string,
  ) {}
}
