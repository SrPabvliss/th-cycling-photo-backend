export class GetPhotoViewQuery {
  constructor(
    public readonly slug: string,
    public readonly userId: string,
  ) {}
}
