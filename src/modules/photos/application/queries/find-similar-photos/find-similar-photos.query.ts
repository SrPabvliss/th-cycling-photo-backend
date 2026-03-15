export class FindSimilarPhotosQuery {
  constructor(
    public readonly photoId: string,
    public readonly limit: number = 10,
  ) {}
}
