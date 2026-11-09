export class UpdateEventPhotoQuotaCommand {
  constructor(
    public readonly eventId: string,
    public readonly quota: number | null,
  ) {}
}
