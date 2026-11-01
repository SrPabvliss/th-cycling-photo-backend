export class GetClassificationFailuresQuery {
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
  ) {}
}
