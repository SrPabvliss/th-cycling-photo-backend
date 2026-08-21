export class GetPhotoDetailBySlugQuery {
  constructor(
    public readonly slug: string,
    public readonly userId: string,
  ) {}
}
