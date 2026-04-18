export class GetRetouchQueueQuery {
  constructor(
    public readonly eventId: string,
    public readonly operatorId: string,
  ) {}
}
