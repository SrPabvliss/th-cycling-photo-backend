export class DeletePhotoBibCommand {
  constructor(
    public readonly photoId: string,
    public readonly bibId: string,
    public readonly reviewerId: string,
  ) {}
}
