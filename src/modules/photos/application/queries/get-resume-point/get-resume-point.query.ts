export class GetResumePointQuery {
  constructor(
    public readonly eventId: string,
    public readonly limit: number,
    public readonly userId: string,
  ) {}
}
