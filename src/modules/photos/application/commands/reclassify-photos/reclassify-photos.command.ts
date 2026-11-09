export class ReclassifyPhotosCommand {
  constructor(
    public readonly eventId: string,
    public readonly photoIds: string[] | null,
    public readonly userId: string,
  ) {}
}
