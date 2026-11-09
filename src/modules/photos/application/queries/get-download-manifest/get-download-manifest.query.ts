export class GetDownloadManifestQuery {
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
  ) {}
}
