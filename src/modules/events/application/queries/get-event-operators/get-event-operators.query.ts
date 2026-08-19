export class GetEventOperatorsQuery {
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
  ) {}
}
