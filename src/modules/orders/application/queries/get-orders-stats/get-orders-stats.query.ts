export class GetOrdersStatsQuery {
  constructor(
    public readonly eventId: string | undefined,
    public readonly userId: string,
  ) {}
}
