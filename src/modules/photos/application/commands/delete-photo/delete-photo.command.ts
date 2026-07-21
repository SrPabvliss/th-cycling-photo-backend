export class DeletePhotoCommand {
  constructor(
    public readonly photoId: string,
    public readonly userId: string,
  ) {}
}
