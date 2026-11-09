export class GetEventDetailQuery {
  constructor(
    public readonly slug: string,
    public readonly userId: string,
  ) {}
}
