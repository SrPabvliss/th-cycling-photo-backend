export class GetEventsListQuery {
  constructor(
    public readonly page: number,
    public readonly limit: number,
  ) {}
}
