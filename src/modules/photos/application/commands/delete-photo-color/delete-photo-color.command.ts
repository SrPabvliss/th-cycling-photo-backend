export class DeletePhotoColorCommand {
  constructor(
    public readonly photoId: string,
    public readonly colorId: string,
    public readonly reviewerId: string,
  ) {}
}
